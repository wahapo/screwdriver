'use strict';

const joi = require('joi');
const schema = require('screwdriver-data-schema');
const tinytim = require('tinytim');
const idSchema = joi.reach(schema.models.pipeline.base, 'id');

/**
 * Generate Badge URL
 * @method getUrl
 * @param  {string}  badgeService    Template URL for badges - needs {{status}} and {{color}}
 * @param  {Array}  [builds]         An array of builds
 * @return {string}                  URL to redirect to
 */
function getUrl({ badgeService, statusColor, builds = [], subject = 'job' }) {
    let color = 'lightgrey';
    let status = '';

    if (builds.length > 0) {
        status = builds[0].status.toLowerCase();
        color = statusColor[status];
    }

    return tinytim.tim(badgeService, {
        subject,
        status,
        color
    });
}

module.exports = config => ({
    method: 'GET',
    path: '/pipelines/{id}/{jobName}/badge',
    config: {
        description: 'Get a badge for a job',
        notes: 'Redirects to the badge service',
        tags: ['api', 'job', 'badge'],
        handler: (request, reply) => {
            const jobFactory = request.server.app.jobFactory;
            const pipelineFactory = request.server.app.pipelineFactory;
            const { id, jobName } = request.params;
            const badgeService = request.server.app.ecosystem.badges;
            const { statusColor } = config;
            const badgeConfig = {
                badgeService,
                statusColor
            };

            return Promise.all([
                jobFactory.get({
                    pipelineId: id,
                    name: jobName
                }),
                pipelineFactory.get(id)
            ]).then(([job, pipeline]) => {
                if (!job) {
                    return reply.redirect(getUrl(badgeConfig));
                }

                const listConfig = {
                    paginate: {
                        page: 1,
                        count: 1
                    }
                };

                return job.getBuilds(listConfig)
                    .then(builds => reply.redirect(getUrl(Object.assign(
                        badgeConfig,
                        {
                            builds,
                            subject: `${pipeline.name}:${jobName}`
                        }))));
            }).catch(() => reply.redirect(getUrl(badgeConfig)));
        },
        validate: {
            params: {
                id: idSchema,
                jobName: joi.reach(schema.models.job.base, 'name')
            }
        }
    }
});
