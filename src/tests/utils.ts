import test from 'ava'
import { maxInKeys, sumByKeys } from '../utils'

const object1 = {
  x: 3,
  y: 4,
  z: 5,
}

const object2 = {
  x: 3,
  y: 4,
  z: 'foobar',
}

const object3 = {
  x: 3,
  y: '4',
  z: '4.0',
  a: 'foobar',
}

test('utilities: sum by keys', (t) => {
  t.is(sumByKeys(object1), 12)
  t.is(sumByKeys(object1, ['x']), 3)
  t.is(sumByKeys(object1, ['x', 'non-existent']), 3)

  t.assert(Math.abs(sumByKeys(object2, ['y', 'x']) - 7) < Number.EPSILON)
  t.assert(Math.abs(sumByKeys(object3, ['x', 'y']) - 7) < Number.EPSILON)
})

test('utilities: max in keys', (t) => {
  t.is(maxInKeys(object1), 5)
  t.is(maxInKeys(object1, ['x']), 3)
  t.is(maxInKeys(object1, ['non-existent']), 0)
  t.is(maxInKeys(object1, ['z', 'non-existent']), 5)

  t.assert(Math.abs(maxInKeys(object2, ['y', 'x']) - 4) < Number.EPSILON)
  t.assert(Math.abs(maxInKeys(object2, ['x', 'foobar']) - 3) < Number.EPSILON)
  t.assert(Math.abs(maxInKeys(object3, ['x', 'y']) - 4) < Number.EPSILON)
  t.assert(Math.abs(maxInKeys(object3, ['y', 'z']) - 4) < Number.EPSILON)
})
