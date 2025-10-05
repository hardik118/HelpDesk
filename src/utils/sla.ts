export type Priority = "high" | "medium" | "low";

export function getSlaDue(priority: Priority): Date {
  const now = new Date();
  if (priority === "high") now.setHours(now.getHours() + 12);
  else if (priority === "medium") now.setHours(now.getHours() + 24);
  else now.setHours(now.getHours() + 48);
  return now;
}
