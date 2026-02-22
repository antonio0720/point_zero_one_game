interface Event {
name: string;
category: string;
properties?: Record<string, any>;
}

const eventTaxonomy10: Record<string, Event[]> = {
'Category_A': [
{ name: 'EventA1', category: 'Category_A' },
{ name: 'EventA2', category: 'Category_A' },
// Add more events as needed
],
'Category_B': [
{ name: 'EventB1', category: 'Category_B' },
{ name: 'EventB2', category: 'Category_B' },
// Add more events as needed
],
// ... Add more categories and events as needed
};

export default eventTaxonomy10;
