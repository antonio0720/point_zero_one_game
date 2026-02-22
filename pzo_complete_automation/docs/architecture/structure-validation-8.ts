const validator = structureValidator();
ts.transpileModule(yourSourceCode, {}, (result) => {
ts.visitEachChild(result.outputText, validator, context);
});
