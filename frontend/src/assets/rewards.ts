const REWARDS_LIST = [
  { id: "carbon-bottle", name: "碳纤维水壶", description: "500ml 轻量化碳纤维水壶", image: "/uploads/reward-bottle.png", pointsRequired: 2000 },
  { id: "custom-grip", name: "握把套", description: "真皮握把", image: "/uploads/reward-grip.png", pointsRequired: 1200 },
];

export interface RewardItem {
  id: string;          // 对应后端 REWARDS_CONFIG 的 id
  name: string;
  description: string;
  image: string;       // 奖品图片路径，例如 /uploads/xxx.png
  pointsRequired: number; // 需与后端 REWARDS_CONFIG 严格一致
}

export default REWARDS_LIST;