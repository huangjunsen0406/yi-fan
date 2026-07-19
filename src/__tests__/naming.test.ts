import { describe, it, expect } from 'vitest'
import { toNamingFormat } from '../utils/naming'

describe('toNamingFormat', () => {
  it('camelCase', () => {
    expect(toNamingFormat('hello world', 'camelCase')).toBe('helloWorld')
  })
  it('PascalCase', () => {
    expect(toNamingFormat('hello world', 'PascalCase')).toBe('HelloWorld')
  })
  it('snake_case', () => {
    expect(toNamingFormat('Hello World', 'snake_case')).toBe('hello_world')
  })
  it('kebab-case', () => {
    expect(toNamingFormat('Hello World', 'kebab-case')).toBe('hello-world')
  })
  it('CONSTANT_CASE', () => {
    expect(toNamingFormat('hello world', 'CONSTANT_CASE')).toBe('HELLO_WORLD')
  })
  it('strips punctuation', () => {
    expect(toNamingFormat('foo, bar!', 'snake_case')).toBe('foo_bar')
  })
})
