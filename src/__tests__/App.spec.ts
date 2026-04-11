import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('mounts and renders ShiftWisher', () => {
    const wrapper = mount(App)
    expect(wrapper.find('.shift-wisher').exists()).toBe(true)
  })
})
