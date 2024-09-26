import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { isText, Element } from 'domhandler';

export interface ParsedQuery {
  years: Array<number>;
  fetchAll: boolean;
  lastYear: boolean;
  format: QueryParams['format'];
}

interface QueryParams {
  y?: string | Array<string>;
  format?: 'nested';
}

type Level = 0 | 1 | 2 | 3 | 4;
type Year = number | 'last';

interface Contribution {
  date: string;
  count: number;
  level: Level;
}

export interface Response {
  total: {
    [year: number]: number;
    [year: string]: number; // 'lastYear'
  };
  contributions: Array<Contribution>;
}

export interface NestedResponse {
  total: {
    [year: number]: number;
    [year: string]: number; // 'lastYear'
  };
  contributions: {
    [year: number]: {
      [month: number]: {
        [day: number]: Contribution;
      };
    };
  };
}

const requestOptions = (username: string) => ({
  method: 'GET',
  headers: {
    referer: `https://github.com/${username}`,
    'x-requested-with': 'XMLHttpRequest',
  },
});

@Injectable()
export class GithubService {
  /**
   * @throws UserNotFoundError
   */
  private async scrapeYearLinks(
    username: string,
    years?: string,
  ): Promise<Array<{ year: number }>> {
    try {
      const url = `https://github.com/${username}?action=show&controller=profiles&tab=contributions&user_id=${username}`;
      const response = await axios.get(url, requestOptions(username));
      const $ = cheerio.load(response.data);

      return $('.js-year-link')
        .get()
        .map((a) => ({
          year: parseInt($(a).text().trim()),
        }))
        .filter((link) =>
          years ? years.includes(link.year.toString()) : true,
        );
    } catch (error) {
      throw new UserNotFoundError(username);
    }
  }

  /**
   * @throws Error if scraping of GitHub profile fails
   */
  private async scrapeContributionsForYear(
    year: Year,
    username: string,
  ): Promise<Response | NestedResponse> {
    const url =
      year === 'last'
        ? `https://github.com/users/${username}/contributions`
        : `https://github.com/users/${username}/contributions?tab=overview&from=${year}-12-01&to=${year}-12-31`;

    const axiosResponse = await axios.get(url, requestOptions(username));
    const $ = cheerio.load(axiosResponse.data);

    const days = $('.js-calendar-graph-table .ContributionCalendar-day');
    const sortedDays = days.get().sort((a, b) => {
      const dateA = a.attribs['data-date'] ?? '';
      const dateB = b.attribs['data-date'] ?? '';
      return dateA.localeCompare(dateB, 'en');
    });

    const totalMatch = $('.js-yearly-contributions h2')
      .text()
      .trim()
      .match(/^([0-9,]+)\s/);

    if (!totalMatch) {
      throw Error('Unable to parse total contributions count.');
    }

    const total = parseInt(totalMatch[0].replace(/,/g, ''));

    const tooltipsByDayId = $('.js-calendar-graph tool-tip')
      .toArray()
      .reduce<Record<string, Element>>((map, elem) => {
        map[elem.attribs['for']] = elem;
        return map;
      }, {});

    const response: Response | NestedResponse = {
      total: {
        [year]: total,
      },
      contributions: [],
    };

    response.contributions = sortedDays.map(
      (day) => this.parseDay(day, tooltipsByDayId).contribution,
    );

    return response;
  }

  private parseDay(day: Element, tooltipsByDayId: Record<string, Element>) {
    const attr = {
      id: day.attribs['id'],
      date: day.attribs['data-date'],
      level: day.attribs['data-level'],
    };

    if (!attr.date) {
      throw Error('Unable to parse contribution date attribute.');
    }

    if (!attr.level) {
      throw Error('Unable to parse contribution level attribute.');
    }

    let count = 0;
    if (tooltipsByDayId[attr.id]) {
      const text = tooltipsByDayId[attr.id].firstChild;
      if (text && isText(text)) {
        const countMatch = text.data.trim().match(/^\d+/);
        if (countMatch) {
          count = parseInt(countMatch[0]);
        }
      }
    }

    const level = parseInt(attr.level) as Level;

    if (isNaN(count)) {
      throw Error('Unable to parse contribution count.');
    }

    if (isNaN(level)) {
      throw Error('Unable to parse contribution level.');
    }

    const contribution: Contribution = {
      date: attr.date,
      count,
      level,
    };

    return {
      date: attr.date.split('-').map((d: string) => parseInt(d)),
      contribution,
    };
  }

  /**
   * @throws UserNotFoundError
   */
  public async scrapeGitHubContributions(
    username: string,
    years?: string,
  ): Promise<Response | NestedResponse> {
    const yearLinks = await this.scrapeYearLinks(username, years);
    let contributionsForYear = [];

    if (years === 'last') {
      contributionsForYear.push(
        this.scrapeContributionsForYear('last', username),
      );
    } else {
      contributionsForYear = yearLinks.map((link) =>
        this.scrapeContributionsForYear(link.year, username),
      );
    }

    return Promise.all(contributionsForYear).then((contributions) => {
      return (contributions as Array<Response>).reduce(
        (acc, curr) => ({
          total: { ...acc.total, ...curr.total },
          contributions: [...acc.contributions, ...curr.contributions],
        }),
        {
          total: {},
          contributions: [],
        } as Response,
      );
    });
  }
}

export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`User "${username}" not found.`);
  }
}
