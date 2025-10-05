"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlaDue = getSlaDue;
function getSlaDue(priority) {
    const now = new Date();
    if (priority === "high")
        now.setHours(now.getHours() + 12);
    else if (priority === "medium")
        now.setHours(now.getHours() + 24);
    else
        now.setHours(now.getHours() + 48);
    return now;
}
