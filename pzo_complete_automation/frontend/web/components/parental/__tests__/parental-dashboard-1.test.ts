import React from 'react';
import { mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import ParentalDashboard from '../ParentalDashboard';

describe('Parental controls + consent - parental-dashboard-1', () => {
it('renders the Parental Dashboard correctly', () => {
const wrapper = mount(<ParentalDashboard />);
expect(toJson(wrapper)).toMatchSnapshot();
});

it('checks if a child account exists', () => {
const wrapper = mount(<ParentalDashboard hasChildAccount={true} />);
expect(wrapper.find('.child-account-exists').length).toBe(1);
});

it('checks if no child account exists', () => {
const wrapper = mount(<ParentalDashboard hasChildAccount={false} />);
expect(wrapper.find('.no-child-account').length).toBe(1);
});

it('checks if the consent is pending', () => {
const wrapper = mount(<ParentalDashboard isConsentPending={true} />);
expect(wrapper.find('.consent-pending').length).toBe(1);
});

it('checks if the consent has been accepted', () => {
const wrapper = mount(<ParentalDashboard isConsentAccepted={true} />);
expect(wrapper.find('.consent-accepted').length).toBe(1);
});
});
