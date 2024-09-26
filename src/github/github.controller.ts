import { Controller, Get, Param, Query } from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('contributions')
  async getContributions(
    @Query('username') username: string,
    @Query('years') years?: string,
  ) {
    return this.githubService.scrapeGitHubContributions(username, years);
  }
}
