/** Stops are lettered in the order they were made: A, B, … Z, AA, AB, … */
export const stopLetter = (index) => {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};
