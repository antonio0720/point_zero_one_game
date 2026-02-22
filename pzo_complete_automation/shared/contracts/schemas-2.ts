import * as Joi from 'joi';

export const UserSchema = Joi.object({
id: Joi.number().integer().required(),
name: Joi.string().min(3).max(50).required(),
email: Joi.string().email().required(),
password: Joi.string().min(8).required(),
});

export const PostSchema = Joi.object({
id: Joi.number().integer().required(),
title: Joi.string().min(3).max(100).required(),
content: Joi.string().min(10).required(),
authorId: Joi.number().integer().required(),
createdAt: Joi.date().iso(),
updatedAt: Joi.date().iso(),
});
