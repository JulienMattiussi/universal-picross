import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Cell from '@/components/game/Cell'

const defaultProps = {
  state: 'unknown' as const,
  row: 0,
  col: 0,
  size: 32,
  onFill: vi.fn(),
  onMark: vi.fn(),
}

describe('Cell', () => {
  it('se rend sans erreur', () => {
    render(<Cell {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('affiche le bon aria-label', () => {
    render(<Cell {...defaultProps} row={1} col={2} />)
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Case 2,3 : unknown',
    )
  })

  it('appelle onFill au clic gauche', () => {
    const onFill = vi.fn()
    render(<Cell {...defaultProps} onFill={onFill} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onFill).toHaveBeenCalledWith(0, 0)
  })

  it('appelle onMark au clic droit', () => {
    const onMark = vi.fn()
    render(<Cell {...defaultProps} onMark={onMark} />)
    fireEvent.contextMenu(screen.getByRole('button'))
    expect(onMark).toHaveBeenCalledWith(0, 0)
  })

  it('affiche une croix pour l\'état marked', () => {
    render(<Cell {...defaultProps} state="marked" />)
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
  })

  it('n\'affiche pas de croix pour l\'état filled', () => {
    render(<Cell {...defaultProps} state="filled" />)
    expect(screen.getByRole('button').querySelector('svg')).toBeNull()
  })

  it('applique la classe d\'erreur quand isError=true', () => {
    render(<Cell {...defaultProps} isError={true} />)
    expect(screen.getByRole('button').className).toContain('bg-red-200')
  })
})
