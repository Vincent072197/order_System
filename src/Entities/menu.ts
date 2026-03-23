type DetailType = {
  title: string;
  price: number;
};
export type MenuType = { id: string; title: string; details: DetailType[] };
export const menu: MenuType[] = [
  {
    id: "test1",
    title: "test1",
    details: [
      { title: "a", price: 23 },
      { title: "b", price: 26 },
    ],
  },
  {
    id: "test2",
    title: "test2",
    details: [
      { title: "a", price: 23 },
      { title: "b", price: 26 },
    ],
  },
  {
    id: "test3",
    title: "test3",
    details: [
      { title: "a", price: 23 },
      { title: "b", price: 26 },
    ],
  },
  {
    id: "test4",
    title: "test4",
    details: [
      { title: "a", price: 23 },
      { title: "b", price: 26 },
    ],
  },
  {
    id: "test5",
    title: "test5",
    details: [
      { title: "a", price: 23 },
      { title: "b", price: 26 },
    ],
  },
  {
    id: "test6",
    title: "test6",
    details: [
      { title: "a", price: 23 },
      { title: "b", price: 26 },
    ],
  },
];
export type ExtendTitleType = (typeof menu)[number]["title"];
