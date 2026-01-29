let counter = 1

setInterval(() => {
  console.log(counter)

  if (Math.random() >= 0.8) {
    process.exit(0)
  }

  counter++
}, 1000)
