import * as Joi from '@hapi/joi';

export const schemaId = Joi.object({
id: Joi.string().alphanum().length(24).hex(),
});

export const schemaIds = Joi.array().items(schemaId);
