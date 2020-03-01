
function defineEnum(array) {
  return Object.freeze(array
    .reduce((obj, item) => {
      if (typeof item === 'string') {
        obj[item.toUpperCase()] = Symbol(item)
      }
      return obj
    }, {}))
}