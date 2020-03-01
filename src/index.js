// import { defineEnum } from 'helpers.js'
// level plan: x is wall; o is coin; ! fixed lava; = is lava moving horizontally; | = vertically moving blob; v vertically moving lava; @ player position; 
const levelPlan = [
  "                            ",
  "                            ",
  "   x                  = x   ",
  "   x         o  o       x   ",
  "   x @      xxxxx       x   ",
  "   xxxxx                x   ",
  "       x!!!!!!!!!!!!x       ",
  "       xxxxxxxxxxxxxx       ",
  "                            ",
]

// const FieldType = defineEnum(['wall', 'lava', 'player', 'coin'])

// > { RED: Symbol(red), GREEN: Symbol(green), BLUE: Symbol(blue) }
// Vector holds position info
function Vector(x, y) {
  this.x = x
  this.y = y
}

Vector.prototype.plus = function (other) {
  return new Vector(this.x + other.x, this.y + other.y)
}
Vector.prototype.times = function (factor) {
  return new Vector(this.x * factor.x, this.y * factor.y)
}

// Player holds player info; pos: top-left coord
function Player(pos) {
  this.pos = pos.plus(new Vector(0, -0.5)) //move player 0.5 square above
  this.size = new Vector(0.8, 1.5)
  this.speed = new Vector(0, 0)
}
Player.prototype.type = "player"

function Lava(pos, ch) {
  this.pos = pos
  this.size = new Vector(1, 1)
  if (ch === "=") {
    this.size = new Vector(2, 0)
  }
  else if (ch === "|") {
    this.size = new Vector(0, 2)
  }
  else if (ch === "v") {
    this.size = new Vector(0, 3)
    this.repeatPos = pos
  }
}
Lava.prototype.type = "lava"

Lava.prototype.act = function (step, level) {
  let newPos = this.pos.plus(this.speed.times(step))
  if (!level.obstacleAt(newPos, this.size))
    this.pos = newPos
  else if (this.repeatPos)
    this.pos = this.repeatPos
  else
    this.speed = this.speed.times(-1)
}
function Coin(pos) {
  this.basePos = this.pos = pos.plus(new Vector(0.2, 0.1))
  this.size = new Vector(0.6, 0.6)
  this.wobble = Math.random() * Math.PI * 2 //random avoids all coins moving in sync
}
Coin.prototype.type = "coin"

let actorChars = {
  "@": Player,
  "o": Coin,
  "=": Lava,
  "|": Lava,
  "v": Lava,
}

// Level constructor takes plan: array of strings
function Level(plan) {
  this.width = plan[0].length
  this.height = plan.length
  this.grid = [] //array of gridLines
  this.actors = []  //array of dynamic elements; each has a pos, size and type=lava|coin|player
  for (let y = 0; y < this.height; y++) {
    let line = plan[y]
    let gridLine = [] //array[width]= null|wall|lava
    for (let x = 0; x < this.width; x++) {
      let ch = line[x]
      let fieldType = null
      let actorType = actorChars[ch]
      if (actorType) {
        let actor = new actorType(new Vector(x, y), ch)
        this.actors.push(actor)
        if (actor.type === "player") this.player = actor
      }
      else if (ch === "x")
        fieldType = "wall"
      else if (ch === "!")
        fieldType = "lava"
      gridLine.push(fieldType)
    }
    this.grid.push(gridLine)
  }
  // status: tracks whether palyer won or lost
  this.status = this.finishDelay = null
}

Level.prototype.isFinished = function () {
  return this.status !== null && this.finishDelay < 0
}


// obstacleAt determines whether a rect overlaps with nonempty space in the background grid
Level.prototype.obstacleAt = function (pos, size) {
  let xStart = Math.floor(pos.x)
  let xEnd = Math.ceil(pos.x + size.x)
  let yStart = Math.floor(pos.y)
  let yEnd = Math.ceil(pos.y + size.y)
  // if the player is outside the grid, return wall or lava so he dies
  if (xStart < 0 || xEnd > this.width || yStart < 0)
    return "wall"
  if (yEnd > this.height)
    return "lava"
  // if inside the grid, return the first nonempty square we find
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let fieldType = this.grid[y][x]
      if (fieldType) return fieldType
    }
  }

}

Level.prototype.actorAt = function (actor) {
  for (other of this.actors) {
    if (other !== actor &&
      actor.pos.x + actor.size.x > other.pos.x &&
      actor.pos.x < other.pos.x + other.size.x &&
      actor.pos.y + actor.size.y > other.pos.y &&
      actor.pos.y < other.pos.y + other.size.y)
      return other
  }
}

const maxStep = 0.05
// animate moves all actors; step time in seconds; keys pressed arrow keys
Level.prototype.animate = function (step, keys) {
  // if game over, count down finishDelay
  if (this.status !== null)
    this.finishDelay -= step
  while (step > 0) {
    let thisStep = Math.min(step, maxStep) //not larger than maxStep
    for (actor of this.actors) {
      actor.act(thisStep, this, keys)
    }
    step -= thisStep
  }
}
// Drawing submodule

function makeEl(name, className) {
  let el = document.createElement(name)
  if (className) el.className = className
  return el
}

// Renderer creates a renderer; parent: root element to attach to; level is a Level object
function Renderer(parent, level) {
  const scale = 20
  // store ref to a wrapper el
  this.wrap = parent.appendChild(makeEl("div", "game"))
  this.level = level
  this.wrap.appendChild(this.drawBackGround(scale))
  this.actorLayer = null
  this.drawFrame(scale)
}

// drawBackGround renders fixed elements using an html table
Renderer.prototype.drawBackGround = function (scale) {
  let table = makeEl("table", "background")
  table.style.width = this.level.width * scale + "px"
  this.level.grid.forEach(function (row) {
    let rowEl = table.appendChild(makeEl("tr"))
    rowEl.style.height = scale + "px"
    row.forEach(function name(type) {
      rowEl.appendChild(makeEl("td", type))
    })
  })
  return table
}

Renderer.prototype.drawFrame = function (scale) {
  // recreate the dynamic elements when we redraw the frame
  if (this.actorLayer)
    this.wrap.removeChild(this.actorLayer)
  this.actorLayer = this.wrap.appendChild(this.drawActors(scale))
  // use level.status as an css class to change appearance 
  this.wrap.className = "game " + (this.level.status || "")
  this.scrollPlayerIntoView()

}

// drawActors draws dynamic elements using a div for each
Renderer.prototype.drawActors = function (scale) {
  let wrap = makeEl("div")
  this.level.actors.forEach(function (actor) {
    let el = wrap.appendChild(makeEl("div", "actor " + actor.type))  //two css classes actor plus coin, etc
    el.style.width = actor.size.x * scale + "px"
    el.style.height = actor.size.y * scale + "px"
    el.style.left = actor.pos.x * scale + "px"
    el.style.top = actor.pos.y * scale + "px"
  })
  return wrap
}

Renderer.prototype.scrollPlayerIntoView = function () {
  let width = this.wrap.clientWidth
  let height = this.wrap.clientHeight
  let margin = width / 3

  //the viewport
  let left = this.wrap.scrollLeft
  let right = left + width
  let top = this.wrap.scrollTop
  let bottom = top + height

  let player = this.level.player
  let center = player.pos.plus(player.size.times(0.5))

  if (center.x < left + margin)
    this.wrap.scrollLeft = center.x - margin
  else if (center.x > right - margin)
    this.wrap.scrollLeft = center.x + margin - width

  if (center.y < top + margin)
    this.wrap.scrollTop = center.y - margin
  else if (center.y > bottom - margin)
    this.wrap.scrollTop = center.y + margin - height

}
// clear clears the displayed level
Renderer.prototype.clear = function () {
  this.wrap.parentNode.removeChild(this.wrap)
}


// Physics



let level = new Level(levelPlan)

new Renderer(document.body, level)