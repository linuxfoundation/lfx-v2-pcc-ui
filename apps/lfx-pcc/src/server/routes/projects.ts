// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response, Router } from 'express';

import { ApiClientService } from '../services/api-client.service';
import { MicroserviceProxyService } from '../services/microservice-proxy.service';
import { NatsService } from '../services/nats.service';
import { ProjectService } from '../services/project.service';
import { SupabaseService } from '../services/supabase.service';

const router = Router();

const supabaseService = new SupabaseService();
const microserviceProxyService = new MicroserviceProxyService(new ApiClientService());
const natsService = new NatsService();
const projectService = new ProjectService(microserviceProxyService, natsService);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  req.log.info(
    {
      operation: 'fetch_projects',
      query_params: req.query,
    },
    'Starting project fetch request'
  );

  try {
    const projects = await projectService.getProjects(req, req.query as Record<string, any>);

    const duration = Date.now() - startTime;

    req.log.info(
      {
        operation: 'fetch_projects',
        project_count: projects.length,
        duration,
        status_code: 200,
      },
      'Successfully fetched projects'
    );

    return res.json(projects);
  } catch (error) {
    const duration = Date.now() - startTime;
    req.log.error(
      {
        error: error instanceof Error ? error.message : error,
        operation: 'fetch_projects',
        duration,
        query_params: req.query,
      },
      'Failed to fetch projects'
    );
    return next(error);
  }
});

router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { q } = req.query;

  req.log.info(
    {
      operation: 'search_projects',
      has_query: !!q,
    },
    'Starting project search request'
  );

  try {
    if (!q || typeof q !== 'string') {
      req.log.warn(
        {
          operation: 'search_projects',
          error: 'Missing or invalid search query',
          query_type: typeof q,
          status_code: 400,
        },
        'Bad request: Search query validation failed'
      );

      return res.status(400).json({
        error: 'Search query is required',
        code: 'MISSING_SEARCH_QUERY',
      });
    }

    const results = await projectService.searchProjects(req, q);

    const duration = Date.now() - startTime;

    req.log.info(
      {
        operation: 'search_projects',
        result_count: results.length,
        duration,
        status_code: 200,
      },
      'Successfully searched projects'
    );

    return res.json(results);
  } catch (error) {
    const duration = Date.now() - startTime;
    req.log.error(
      {
        error: error instanceof Error ? error.message : error,
        operation: 'search_projects',
        duration,
      },
      'Failed to search projects'
    );
    return next(error);
  }
});

router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const projectSlug = req.params['slug'];

  req.log.info(
    {
      operation: 'fetch_project_by_slug',
      slug: projectSlug,
    },
    'Starting project fetch by slug request'
  );

  try {
    if (!projectSlug) {
      req.log.warn(
        {
          operation: 'fetch_project_by_slug',
          error: 'Missing project slug parameter',
          status_code: 400,
        },
        'Bad request: Project slug validation failed'
      );

      return res.status(400).json({
        error: 'Project Slug is required',
        code: 'MISSING_PROJECT_SLUG',
      });
    }

    // Use the project service to handle slug resolution and project fetching
    const project = await projectService.getProjectBySlug(req, projectSlug);

    const duration = Date.now() - startTime;
    req.log.info(
      {
        operation: 'fetch_project_by_slug',
        slug: projectSlug,
        project_uid: project.uid,
        duration,
        status_code: 200,
      },
      'Successfully fetched project'
    );

    return res.json(project);
  } catch (error) {
    const duration = Date.now() - startTime;
    req.log.error(
      {
        error: error instanceof Error ? error.message : error,
        operation: 'fetch_project_by_slug',
        slug: projectSlug,
        duration,
      },
      'Failed to fetch project'
    );
    return next(error);
  }
});

router.get('/:slug/recent-activity', async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const projectSlug = req.params['slug'];

  req.log.info(
    {
      operation: 'fetch_project_recent_activity',
      has_project_slug: !!projectSlug,
      query_params: req.query,
    },
    'Starting project recent activity fetch request'
  );

  try {
    if (!projectSlug) {
      req.log.warn(
        {
          operation: 'fetch_project_recent_activity',
          error: 'Missing project slug parameter',
          status_code: 400,
        },
        'Bad request: Project slug validation failed'
      );

      return res.status(400).json({
        error: 'Project Slug is required',
        code: 'MISSING_PROJECT_SLUG',
      });
    }

    // Get project to verify it exists and get the project ID
    const project = await projectService.getProjectBySlug(req, projectSlug);

    const recentActivity = await supabaseService.getRecentActivityByProject(project.uid, req.query as Record<string, any>);
    const duration = Date.now() - startTime;

    req.log.info(
      {
        operation: 'fetch_project_recent_activity',
        project_uid: project.uid,
        activity_count: recentActivity.length,
        duration,
        status_code: 200,
      },
      'Successfully fetched project recent activity'
    );

    return res.json(recentActivity);
  } catch (error) {
    const duration = Date.now() - startTime;
    req.log.error(
      {
        error: error instanceof Error ? error.message : error,
        operation: 'fetch_project_recent_activity',
        duration,
      },
      'Failed to fetch recent activity for project'
    );
    return next(error);
  }
});

export default router;
