import React from 'react';
import { shallow, mount } from 'enzyme';
import Dashboards from './Dashboards';
import { Dashboard1, Dashboard2 } from './components'; // Adjust the import paths as needed

describe('Dashboards', () => {
it('renders Dashboard1 and Dashboard2 components', () => {
const wrapper = shallow(<Dashboards />);
expect(wrapper.find(Dashboard1).length).toBe(1);
expect(wrapper.find(Dashboard2).length).toBe(1);
});

it('checks if Dashboard1 has the correct title', () => {
const wrapper = mount(<Dashboard1 />);
expect(wrapper.find('h1').text()).toEqual('Title of Dashboard1'); // Adjust the expected title as needed
});

it('checks if Dashboard2 has the correct data', () => {
const mockData = [/* ... */]; // Define mock data for Dashboard2 as needed
const wrapper = mount(<Dashboard2 data={mockData} />);
// Add your assertions here to check if the data is being correctly displayed in Dashboard2
});
});
