import { join } from "https://deno.land/std/path/mod.ts";
import { parse } from "https://deno.land/std/encoding/csv.ts";
import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { pick } from "https://deno.land/x/lodash@4.17.15-es/lodash.js";
;
async function loadPlanetData() {
    const path = join(".", "kepler_exoplanets_nasa.csv");
    const file = await Deno.open(path);
    const bufReader = new BufReader(file);
    const result = await parse(bufReader, {
        header: true,
        comment: "#",
    });
    Deno.close(file.rid);
    const planets = result.filter((planet) => {
        const planetaryRadius = Number(planet["koi_prad"]);
        const stellarRadius = Number(planet["koi_srad"]);
        const stellarMass = Number(planet["koi_smass"]);
        return planet["koi_disposition"] === "CONFIRMED"
            && planetaryRadius > 0.5 && planetaryRadius < 1.5
            && stellarRadius > 0.99 && stellarRadius < 1.01
            && stellarMass > 0.78 && stellarMass < 1.04;
    });
    return planets.map((planet) => {
        return pick(planet, [
            "kepler_name",
            "koi_prad",
            "koi_smass",
            "koi_srad",
            "koi_count",
            "koi_steff"
        ]);
    });
}
const newEarths = await loadPlanetData();
for (const planet of newEarths) {
    console.log(planet);
}
console.log(`${newEarths.length} habitable planets found!`);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTlELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUl0RSxDQUFDO0FBRUYsS0FBSyxVQUFVLGNBQWM7SUFDM0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO0lBRXJELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuQyxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV0QyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxTQUFTLEVBQUU7UUFDcEMsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsR0FBRztLQUNiLENBQUMsQ0FBQztJQUdILElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXJCLE1BQU0sT0FBTyxHQUFJLE1BQXdCLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDMUQsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNqRCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFFaEQsT0FBTyxNQUFNLENBQUMsaUJBQWlCLENBQUMsS0FBSyxXQUFXO2VBQzNDLGVBQWUsR0FBRyxHQUFHLElBQUksZUFBZSxHQUFHLEdBQUc7ZUFDOUMsYUFBYSxHQUFHLElBQUksSUFBSSxhQUFhLEdBQUcsSUFBSTtlQUM1QyxXQUFXLEdBQUcsSUFBSSxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDaEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtRQUM1QixPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDbEIsYUFBYTtZQUNiLFVBQVU7WUFDVixXQUFXO1lBQ1gsVUFBVTtZQUNWLFdBQVc7WUFDWCxXQUFXO1NBQ1osQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUE7QUFDSixDQUFDO0FBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxjQUFjLEVBQUUsQ0FBQztBQUN6QyxLQUFLLE1BQU0sTUFBTSxJQUFJLFNBQVMsRUFBRTtJQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ3JCO0FBQ0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLDJCQUEyQixDQUFDLENBQUEifQ==