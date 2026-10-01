import { describe, it, expect } from 'vitest'
import { Note, InvalidNoteError } from '../../src/shared/domain/index.js'

describe('Note Domain Entity', () => {
  describe('Creation and Invariants', () => {
    it('should create a valid Note with bookId and content', () => {
      const note = Note.create({
        bookId: 10,
        content: 'Idea principal sobre la inversión de dependencias.'
      })

      expect(note.bookId).toBe(10)
      expect(note.content).toBe('Idea principal sobre la inversión de dependencias.')
      expect(note.createdAt).toBeInstanceOf(Date)
      expect(note.updatedAt).toBeInstanceOf(Date)
    })

    it('should reject empty or whitespace-only content', () => {
      expect(() => {
        Note.create({
          bookId: 10,
          content: '   '
        })
      }).toThrow(InvalidNoteError)

      expect(() => {
        Note.create({
          bookId: 10,
          content: ''
        })
      }).toThrow(InvalidNoteError)
    })

    it('should reject invalid bookId (0, negative, non-integer)', () => {
      expect(() => {
        Note.create({
          bookId: 0,
          content: 'Nota'
        })
      }).toThrow(InvalidNoteError)

      expect(() => {
        Note.create({
          bookId: -1,
          content: 'Nota'
        })
      }).toThrow(InvalidNoteError)

      expect(() => {
        Note.create({
          bookId: 1.5,
          content: 'Nota'
        })
      }).toThrow(InvalidNoteError)
    })
  })

  describe('Mutations', () => {
    it('should update content and update timestamp', () => {
      const note = Note.create({
        bookId: 1,
        content: 'Contenido original'
      })

      const oldUpdatedAt = note.updatedAt
      note.updateContent('Contenido modificado y ampliado')

      expect(note.content).toBe('Contenido modificado y ampliado')
      expect(note.updatedAt.getTime()).toBeGreaterThanOrEqual(oldUpdatedAt.getTime())
    })

    it('should reject empty content on updateContent', () => {
      const note = Note.create({
        bookId: 1,
        content: 'Contenido válido'
      })

      expect(() => {
        note.updateContent('   ')
      }).toThrow(InvalidNoteError)
    })
  })

  describe('Serialization to and from Primitives', () => {
    it('should serialize to primitives and reconstruct from primitives accurately', () => {
      const createdAt = new Date('2026-03-01T08:30:00Z')
      const updatedAt = new Date('2026-03-01T09:00:00Z')

      const originalNote = new Note({
        id: 99,
        bookId: 12,
        content: 'Reflexión clave sobre acoplamiento y cohesión.',
        createdAt,
        updatedAt
      })

      const primitives = originalNote.toPrimitives()
      expect(primitives).toEqual({
        id: 99,
        bookId: 12,
        content: 'Reflexión clave sobre acoplamiento y cohesión.',
        createdAt,
        updatedAt
      })

      const reconstructed = Note.fromPrimitives(primitives)
      expect(reconstructed).toBeInstanceOf(Note)
      expect(reconstructed.id).toBe(99)
      expect(reconstructed.bookId).toBe(12)
      expect(reconstructed.content).toBe('Reflexión clave sobre acoplamiento y cohesión.')
      expect(reconstructed.createdAt).toEqual(createdAt)
      expect(reconstructed.updatedAt).toEqual(updatedAt)
    })
  })
})
