import * as Joi from '@hapi/joi';

export const IdSchema = Joi.object({
id: Joi.string().alphanum().length(24).hex(),
});

export const AddressSchema = Joi.object({
street: Joi.string().required(),
city: Joi.string().required(),
state: Joi.string().required(),
zip: Joi.string().length(5),
});

export const UserSchema = Joi.object({
id: IdSchema.required(),
firstName: Joi.string().min(1).max(30).required(),
lastName: Joi.string().min(1).max(30).required(),
email: Joi.string().email().lowercase().required(),
phoneNumber: Joi.string().length(10).pattern(/^(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/),
address: AddressSchema.required(),
});

export const ProductSchema = Joi.object({
id: IdSchema.required(),
name: Joi.string().min(1).max(50).required(),
description: Joi.string().min(1).max(255),
price: Joi.number().precision(2).positive().required(),
});

export const OrderSchema = Joi.object({
id: IdSchema.required(),
userId: IdSchema.required(),
date: Joi.date().iso(),
products: Joi.array()
.items(ProductSchema)
.min(1)
.required(),
});
