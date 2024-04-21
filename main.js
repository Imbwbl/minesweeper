let main = document.getElementById("main");
let table = []
let size = 5
let bombs = 5

main.style.gridTemplateColumns = `repeat(${size}, 1fr)`
main.style.gridTemplateRows = `repeat(${size}, 1fr)`
for (let i = 0; i < size; i++) {
    table.push([])
    for (let j = 0; j < size; j++) {
        table[i].push(0)
    }
}

function genMine() {
    let array = Math.floor(Math.random() * size);
    let rand = Math.floor(Math.random() * size);
    if (table[array][rand] !== "💣") {
        table[array][rand] = "💣";
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) {
                    continue;
                }
                let newRow = array + i;
                let newCol = rand + j;
                if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size && table[newRow][newCol] !== "💣") {
                    table[newRow][newCol] = parseInt(table[newRow][newCol]) + 1;
                }
            }
        }
    } else {
        genMine();
    }
}

for (let i = 0; i < bombs; i++) genMine()

function checkVictory() {
    let element = document.getElementsByTagName("a")
    let listBomb = []
    let listClass = []
    Array.from(element).forEach((e) => {
        if (!e.innerHTML.includes("💣")) listBomb.push(e)
    })
    listBomb.forEach((e) => {
        if (e.classList.contains("hidden")) listClass.push(e)
    })
    if (listClass.length == 1) {
        alert("you win !")
        setTimeout(() => {
            window.location.reload()
        }, 2000)
    }
}

table.forEach((array) => {
    array.forEach((block) => {
        let button = document.createElement("a")
        button.textContent = block
        button.classList.add('hidden');
        button.onclick = () => {
            checkVictory()
            if (block === "💣") {
                Array.from(document.getElementsByClassName("hidden")).forEach((e) => {
                    e.classList.remove("hidden")
                })
                setTimeout(() => {
                    window.location.reload()
                }, 2000)
            }
            if (button.classList.contains('hidden')) {
                button.classList.remove('hidden');
            }
        }
        main.appendChild(button)
    })
})