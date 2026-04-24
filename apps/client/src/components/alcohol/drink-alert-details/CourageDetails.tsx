interface CourageDetailsProps {
  givenAnswer: string;
  correctAnswer: string;
}

export function CourageDetails({
  givenAnswer,
  correctAnswer,
}: CourageDetailsProps) {
  return (
    <div className="mt-6 space-y-2 max-w-sm mx-auto">
      <p className="text-base text-white/80">
        Sa réponse :{" "}
        <span className="text-red-300 font-semibold line-through">
          {givenAnswer}
        </span>
      </p>
      <p className="text-base text-white/80">
        Bonne réponse :{" "}
        <span className="text-green-300 font-semibold">{correctAnswer}</span>
      </p>
    </div>
  );
}
