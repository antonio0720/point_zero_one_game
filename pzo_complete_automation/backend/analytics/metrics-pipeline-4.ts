const metrics = meterProvider.get Meter('your-meter');

const counter = metrics.createUpDownCounter('counter', {
description: 'A simple up/down counter.',
unit: SC.Newtons, // replace with your specific units if needed
});

// To increment the counter
counter.add(1);
