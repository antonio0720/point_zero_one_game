import React from 'react';
import { useValidationPipeline } from '@creator/validation-pipeline';

type Props = {
children: JSX.Element;
};

const ValidationPipeline23: React.FC<Props> = ({ children }) => {
const pipeline = useValidationPipeline(23);

return (
<div>
{pipeline.validate({ children })}
</div>
);
};

export default ValidationPipeline23;
