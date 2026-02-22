import React from 'react';

interface Props {
title: string;
}

const ScenarioBuilder = ({ title }: Props) => {
return (
<div>
<h1>{title}</h1>
{/* Your scenario builder components go here */}
</div>
);
};

export default ScenarioBuilder;
