interface RatingOption {
  label: string;
  value: number;
  className: string;
}

const RATINGS: RatingOption[] = [
  { label: "Again", value: 1, className: "rating-again" },
  { label: "Hard", value: 2, className: "rating-hard" },
  { label: "Good", value: 3, className: "rating-good" },
  { label: "Easy", value: 4, className: "rating-easy" },
];

export function createRatingButtons(onRate: (rating: number) => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "rating-buttons";

  for (const r of RATINGS) {
    const btn = document.createElement("button");
    btn.className = `rating-btn ${r.className}`;
    btn.textContent = r.label;
    btn.addEventListener("click", () => onRate(r.value));
    container.appendChild(btn);
  }

  return container;
}
