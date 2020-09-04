async function readFile() {
  const data = await Deno.readTextFile("hello.txt")

  console.log(data);
}

readFile();