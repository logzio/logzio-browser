let counter = 0;

const padHex = (value: number, length: number) => value.toString(16).padStart(length, '0');

export const v4 = jest.fn(() => {
  counter += 1;
  const tail = padHex(counter, 12);
  return `00000000-0000-4000-8000-${tail}`;
});
