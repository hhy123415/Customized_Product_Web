const REWARDS_LIST = [
  { id: "carbon-bottle", name: "碳纤维水壶架", description: "适用500ml容量的轻量化碳纤维水壶架", image: "/reward-bottle.jpg", pointsRequired: 2000 },
  { id: "custom-grip", name: "握把套", description: "真皮握把", image: "/reward-grip.webp", pointsRequired: 1200 },
];

export interface RewardItem {
  id: string;          // 对应后端 REWARDS_CONFIG 的 id
  name: string;
  description: string;
  image: string;       // 奖品图片路径，例如 /uploads/xxx.png
  pointsRequired: number; // 需与后端 REWARDS_CONFIG 严格一致
}

export default REWARDS_LIST;