import { Controller, Get, Param, Query } from '@nestjs/common';
import { GithubService, ParsedQuery } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get(':username')
  async getContributions(
    @Param('username') username: string,
    @Query('y') years?: string | string[],
    @Query('format') format?: 'nested',
  ) {
    const query: ParsedQuery = {
      years: Array.isArray(years)
        ? years.map(Number)
        : years
          ? [Number(years)]
          : [],
      fetchAll: !years,
      lastYear: !years,
      format: format,
    };

    return this.githubService.scrapeGitHubContributions(username, query);
  }
}
