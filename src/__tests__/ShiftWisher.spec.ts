import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ShiftWisher from '@/components/ShiftWisher.vue'
import { useWishStore } from '@/composables/useWishStore'

describe('ShiftWisher', () => {
  beforeEach(() => {
    // Reset wish store between tests
    useWishStore().clearAll()
  })

  it('renders without errors', () => {
    const wrapper = mount(ShiftWisher)
    expect(wrapper.exists()).toBe(true)
  })

  it('shows current month name', () => {
    const wrapper = mount(ShiftWisher)
    const now = new Date()
    const monthNames = [
      'Januar','Februar','März','April','Mai','Juni',
      'Juli','August','September','Oktober','November','Dezember',
    ]
    expect(wrapper.text()).toContain(monthNames[now.getMonth()])
  })

  it('renders 35 day cells for a calendar month', () => {
    const wrapper = mount(ShiftWisher)
    // Each month renders 35 cells (7×5)
    const cells = wrapper.findAll('[data-testid="cal-day"]')
    expect(cells.length).toBeGreaterThanOrEqual(35)
  })

  it('clicking a day cycles to preferred', async () => {
    const wrapper = mount(ShiftWisher)
    const cells = wrapper.findAll('[data-testid="cal-day"]')
    // Find an in-month cell
    const inMonthCell = cells.find(c => c.classes('in-month'))
    expect(inMonthCell).toBeDefined()
    await inMonthCell!.trigger('click')
    expect(inMonthCell!.classes()).toContain('wish--preferred')
  })

  it('clicking twice cycles to unavailable', async () => {
    const wrapper = mount(ShiftWisher)
    const cells = wrapper.findAll('[data-testid="cal-day"]')
    const inMonthCell = cells.find(c => c.classes('in-month'))!
    await inMonthCell.trigger('click')
    await inMonthCell.trigger('click')
    expect(inMonthCell.classes()).toContain('wish--unavailable')
  })

  it('clicking three times cycles back to available (no wish class)', async () => {
    const wrapper = mount(ShiftWisher)
    const cells = wrapper.findAll('[data-testid="cal-day"]')
    const inMonthCell = cells.find(c => c.classes('in-month'))!
    await inMonthCell.trigger('click')
    await inMonthCell.trigger('click')
    await inMonthCell.trigger('click')
    expect(inMonthCell.classes()).not.toContain('wish--preferred')
    expect(inMonthCell.classes()).not.toContain('wish--unavailable')
  })

  it('renders undo button', () => {
    const wrapper = mount(ShiftWisher)
    expect(wrapper.find('[data-testid="btn-undo"]').exists()).toBe(true)
  })

  it('undo button is disabled initially', () => {
    const wrapper = mount(ShiftWisher)
    const undoBtn = wrapper.find('[data-testid="btn-undo"]')
    expect(undoBtn.attributes('disabled')).toBeDefined()
  })

  it('undo button is enabled after a click', async () => {
    const wrapper = mount(ShiftWisher)
    const cells = wrapper.findAll('[data-testid="cal-day"]')
    const inMonthCell = cells.find(c => c.classes('in-month'))!
    await inMonthCell.trigger('click')
    const undoBtn = wrapper.find('[data-testid="btn-undo"]')
    expect(undoBtn.attributes('disabled')).toBeUndefined()
  })

  it('emits update:wishes after cycling a day', async () => {
    const wrapper = mount(ShiftWisher)
    const cells = wrapper.findAll('[data-testid="cal-day"]')
    const inMonthCell = cells.find(c => c.classes('in-month'))!
    await inMonthCell.trigger('click')
    expect(wrapper.emitted('update:wishes')).toBeTruthy()
    const emitted  = wrapper.emitted('update:wishes')!
    const lastEmit = emitted[emitted.length - 1]!
    expect(Array.isArray(lastEmit[0])).toBe(true)
  })

  describe('multi-day drag → modal', () => {
    // Modal is teleported to document.body — use document.querySelector to find it
    function modalEl()    { return document.body.querySelector('[data-testid="wish-modal"]') }
    function modalBtn(id: string) {
      return document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
    }

    async function clickModalBtn(id: string) {
      const btn = modalBtn(id)
      expect(btn).not.toBeNull()
      btn!.click()
      await nextTick()
    }

    async function dragAcrossTwoDays(wrapper: ReturnType<typeof mount>) {
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const inMonthCells = cells.filter(c => c.classes('in-month'))
      await inMonthCells[0]!.trigger('mousedown')
      await inMonthCells[1]!.trigger('mouseenter')
      await wrapper.find('.cal-body').trigger('mouseup')
    }

    it('shows modal after dragging across multiple days', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      expect(modalEl()).not.toBeNull()
      wrapper.unmount()
    })

    it('modal shows the number of selected days', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      expect(modalEl()?.textContent).toContain('2')
      wrapper.unmount()
    })

    it('modal has a Bevorzugt button', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      expect(modalBtn('modal-btn-preferred')).not.toBeNull()
      wrapper.unmount()
    })

    it('modal has a Nicht verfügbar button', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      expect(modalBtn('modal-btn-unavailable')).not.toBeNull()
      wrapper.unmount()
    })

    it('modal has a Löschen button', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      expect(modalBtn('modal-btn-available')).not.toBeNull()
      wrapper.unmount()
    })

    it('clicking Bevorzugt applies preferred to all dragged days', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const inMonthCells = cells.filter(c => c.classes('in-month'))
      const day1Iso = inMonthCells[0]!.attributes('data-iso')!
      const day2Iso = inMonthCells[1]!.attributes('data-iso')!
      await clickModalBtn('modal-btn-preferred')
      expect(useWishStore().getWishType(day1Iso)).toBe('preferred')
      expect(useWishStore().getWishType(day2Iso)).toBe('preferred')
      wrapper.unmount()
    })

    it('clicking Bevorzugt closes the modal', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      await clickModalBtn('modal-btn-preferred')
      expect(modalEl()).toBeNull()
      wrapper.unmount()
    })

    it('clicking Löschen clears wishes for dragged days', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const inMonthCells = cells.filter(c => c.classes('in-month'))
      const day1Iso = inMonthCells[0]!.attributes('data-iso')!
      const day2Iso = inMonthCells[1]!.attributes('data-iso')!
      useWishStore().setWish(day1Iso, 'preferred')
      useWishStore().setWish(day2Iso, 'preferred')
      await dragAcrossTwoDays(wrapper)
      await clickModalBtn('modal-btn-available')
      expect(useWishStore().getWishType(day1Iso)).toBe('available')
      expect(useWishStore().getWishType(day2Iso)).toBe('available')
      wrapper.unmount()
    })

    it('cancelling the modal closes it without changes', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      await clickModalBtn('modal-btn-cancel')
      expect(modalEl()).toBeNull()
      wrapper.unmount()
    })

    it('applying modal wish is undoable in one step', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const inMonthCells = cells.filter(c => c.classes('in-month'))
      const day1Iso = inMonthCells[0]!.attributes('data-iso')!
      const day2Iso = inMonthCells[1]!.attributes('data-iso')!
      await clickModalBtn('modal-btn-preferred')
      useWishStore().undo()
      expect(useWishStore().getWishType(day1Iso)).toBe('available')
      expect(useWishStore().getWishType(day2Iso)).toBe('available')
      wrapper.unmount()
    })

    it('WishModal has a Notiz textarea', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      expect(document.body.querySelector('[data-testid="modal-note"]')).not.toBeNull()
      wrapper.unmount()
    })

    it('WishModal apply passes note to bulkSetWish', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      await dragAcrossTwoDays(wrapper)
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const inMonthCells = cells.filter(c => c.classes('in-month'))
      const day1Iso = inMonthCells[0]!.attributes('data-iso')!
      // Type a note into the textarea
      const noteArea = document.body.querySelector('[data-testid="modal-note"]') as HTMLTextAreaElement
      noteArea.value = 'Urlaub geplant'
      noteArea.dispatchEvent(new Event('input'))
      await nextTick()
      await clickModalBtn('modal-btn-preferred')
      expect(useWishStore().getNote(day1Iso)).toBe('Urlaub geplant')
      wrapper.unmount()
    })
  })

  describe('note popover', () => {
    function noteBtnFor(wrapper: ReturnType<typeof mount>, dayIso: string) {
      return wrapper.find(`[data-iso="${dayIso}"] [data-testid="note-btn"]`)
    }
    function notePopoverEl() {
      return document.body.querySelector('[data-testid="note-popover"]')
    }

    it('note button is visible on a day with a wish', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const cell = cells.find(c => c.classes('in-month'))!
      const dayIso = cell.attributes('data-iso')!
      await cell.trigger('click')  // set to preferred
      expect(noteBtnFor(wrapper, dayIso).exists()).toBe(true)
      wrapper.unmount()
    })

    it('note button is not visible on a day without a wish', () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const cell = cells.find(c => c.classes('in-month'))!
      const dayIso = cell.attributes('data-iso')!
      expect(noteBtnFor(wrapper, dayIso).exists()).toBe(false)
      wrapper.unmount()
    })

    it('clicking note button opens the NotePopover', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const cell = cells.find(c => c.classes('in-month'))!
      const dayIso = cell.attributes('data-iso')!
      await cell.trigger('click')
      await noteBtnFor(wrapper, dayIso).trigger('click')
      expect(notePopoverEl()).not.toBeNull()
      wrapper.unmount()
    })

    it('saving a note in NotePopover stores it', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const cell = cells.find(c => c.classes('in-month'))!
      const dayIso = cell.attributes('data-iso')!
      await cell.trigger('click')
      await noteBtnFor(wrapper, dayIso).trigger('click')
      const textarea = document.body.querySelector('[data-testid="note-textarea"]') as HTMLTextAreaElement
      textarea.value = 'Test Notiz'
      textarea.dispatchEvent(new Event('input'))
      await nextTick()
      const saveBtn = document.body.querySelector('[data-testid="note-save"]') as HTMLElement
      saveBtn.click()
      await nextTick()
      expect(useWishStore().getNote(dayIso)).toBe('Test Notiz')
      wrapper.unmount()
    })

    it('saving closes the popover', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const cell = cells.find(c => c.classes('in-month'))!
      const dayIso = cell.attributes('data-iso')!
      await cell.trigger('click')
      await noteBtnFor(wrapper, dayIso).trigger('click')
      const textarea = document.body.querySelector('[data-testid="note-textarea"]') as HTMLTextAreaElement
      textarea.value = 'x'
      textarea.dispatchEvent(new Event('input'))
      await nextTick()
      ;(document.body.querySelector('[data-testid="note-save"]') as HTMLElement).click()
      await nextTick()
      expect(notePopoverEl()).toBeNull()
      wrapper.unmount()
    })

    it('note indicator is shown on day cell when note exists', async () => {
      const wrapper = mount(ShiftWisher, { attachTo: document.body })
      const cells = wrapper.findAll('[data-testid="cal-day"]')
      const cell = cells.find(c => c.classes('in-month'))!
      const dayIso = cell.attributes('data-iso')!
      useWishStore().setWish(dayIso, 'preferred')
      useWishStore().setNote(dayIso, 'Notiz hier')
      await nextTick()
      expect(cell.find('[data-testid="note-indicator"]').exists()).toBe(true)
      wrapper.unmount()
    })
  })
})
