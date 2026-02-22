const analyzer = new WindowsForensicsAnalyzer();
const incident: Incident = {
id: 1,
timestamp: new Date(),
description: 'Suspicious network activity detected.',
};
analyzer.analyze(incident);
