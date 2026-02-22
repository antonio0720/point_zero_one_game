import React from 'react';
import { shallow, mount } from 'enzyme';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
it('renders without crashing', () => {
const wrapper = shallow(<MyComponent />);
expect(wrapper.exists()).toBe(true);
});

it('matches the snapshot', () => {
const wrapper = shallow(<MyComponent />);
expect(wrapper).toMatchSnapshot();
});

it('handles click event on button', () => {
const handleClick = jest.fn();
const wrapper = mount(<MyComponent onClick={handleClick} />);
wrapper.find('button').simulate('click');
expect(handleClick).toHaveBeenCalled();
});
});
