import { randomInt } from "node:crypto";

const ADJECTIVES = ["Swift", "Bright", "Bold", "Calm", "Clever", "Daring", "Eager", "Keen", "Lucky", "Mighty", "Nimble", "Quick", "Rapid", "Sharp", "Steady", "Sunny", "Brave", "Witty", "Cosmic", "Golden"];
const ANIMALS = ["Falcon", "Otter", "Comet", "Fox", "Panda", "Tiger", "Orca", "Lynx", "Hawk", "Raven", "Koala", "Badger", "Heron", "Puma", "Gecko", "Bison", "Crane", "Dolphin", "Eagle", "Wolf"];

/** A random leaderboard nickname like "Swift Otter 42". Not derived from the student's name or id. */
export function randomAlias() {
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]} ${ANIMALS[randomInt(ANIMALS.length)]} ${randomInt(10, 100)}`;
}
