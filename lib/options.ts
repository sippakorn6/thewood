import type { MenuCategory } from "./types";

export type OptionGroup = {
  key: string;
  label: string;
  choices: { label: string; extra_thb?: number }[];
  required?: boolean;
};

export function getOptionGroups(category: MenuCategory): OptionGroup[] {
  const isNoodle = category === "ก๋วยเตี๋ยว";
  if (isNoodle) {
    return [
      {
        key: "noodle",
        label: "เส้น",
        required: true,
        choices: [
          { label: "เส้นเล็ก" },
          { label: "เส้นใหญ่" },
          { label: "หมี่ขาว" },
          { label: "บะหมี่" },
        ],
      },
      {
        key: "size",
        label: "ขนาด",
        required: true,
        choices: [
          { label: "ธรรมดา" },
          { label: "พิเศษ" },
        ],
      },
      {
        key: "protein",
        label: "เนื้อ",
        required: true,
        choices: [
          { label: "หมู" },
          { label: "ไก่" },
          { label: "เนื้อ", extra_thb: 10 }, // เพิ่มราคาเฉพาะตัวเลือกชื่อ “เนื้อ”
        ],
      },
    ];
  }

  // อาหาร (ไม่ใช่ก๋วยเตี๋ยว)
  return [
    {
      key: "protein",
      label: "เลือกเนื้อ",
      required: true,
      choices: [
        { label: "หมู" },
        { label: "ไก่" },
        { label: "เนื้อ", extra_thb: 10 }, // ใช้เงื่อนไขเดียวกัน
      ],
    },
    {
      key: "size",
      label: "ขนาด",
      required: true,
      choices: [
        { label: "ธรรมดา", extra_thb: 0 },
        { label: "พิเศษ", extra_thb: 10 }, // ขนาด + ราคา
      ],
    },
    {
      key: "addon",
      label: "เพิ่ม",
      required: false,
      choices: [
        { label: "ไม่เพิ่ม", extra_thb: 0 },
        { label: "ทะเล", extra_thb: 20 }, // ต้องมีในหมวดอาหาร
      ],
    },
  ];
}

export function calcExtra(options: Record<string, string>, groups: OptionGroup[]): number {
  let extra = 0;
  for (const g of groups) {
    const selected = options?.[g.key];
    if (!selected) continue;
    const c = g.choices.find((x) => x.label === selected);
    if (c?.extra_thb) extra += c.extra_thb;
  }
  return extra;
}
