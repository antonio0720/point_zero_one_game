import React from 'react';

interface Props {
data: any;
}

const ValidationPipeline21: React.FC<Props> = ({ data }) => {
const schema = Joi.object({
// Define the validation schema here, for example:
name: Joi.string().required(),
email: Joi.string().email().required(),
password: Joi.string().min(8).required(),
});

const { error } = schema.validate(data);

if (error) {
return <div>Validation Error: {error.message}</div>;
}

return <div>Data is valid</div>;
};

export default ValidationPipeline21;
