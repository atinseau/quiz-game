import { checkAnswer } from "../../../utils/fuzzyMatch";
import { broadcast } from "../../rooms";
import type { QuestionFull, Room } from "../../types";
import { endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

interface CourageState {
  playerClerkId: string;
  question: QuestionFull | null;
  decisionTimeout: ReturnType<typeof setTimeout>;
}

const courageStates = new Map<string, CourageState>();

function getRandomConnectedPlayer(room: Room): string | null {
  const connected = Array.from(room.players.values()).filter(
    (p) => p.connected,
  );
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)]!.clerkId;
}

function pickCourageQuestion(room: Room): QuestionFull | null {
  const game = room.game;
  if (!game) return null;
  for (let i = game.currentQuestionIndex + 1; i < game.questions.length; i++) {
    const q = game.questions[i];
    if (q && q.type === "qcm") {
      game.questions.splice(i, 1);
      return q;
    }
  }
  return null;
}

export const courageRound: ServerRound = {
  type: "courage",
  start(room: Room, _state: AlcoholState) {
    const playerClerkId = getRandomConnectedPlayer(room);
    if (!playerClerkId) {
      endSpecialRound(room);
      return;
    }
    const player = room.players.get(playerClerkId);
    broadcast(room, {
      type: "special_round_start",
      roundType: "courage",
      data: { playerClerkId, playerName: player?.username ?? "?" },
    });
    broadcast(room, {
      type: "courage_decision",
      playerClerkId,
      countdown: 10,
    });
    const decisionTimeout = setTimeout(() => {
      const cs = courageStates.get(room.code);
      if (!cs) return;
      courageStates.delete(room.code);
      broadcast(room, {
        type: "drink_alert",
        targetClerkId: playerClerkId,
        emoji: "🥃",
        message: `${player?.username ?? "?"} n'a pas choisi — la moitié du verre !`,
      });
      setTimeout(() => endSpecialRound(room), 4000);
    }, 10_000);
    courageStates.set(room.code, {
      playerClerkId,
      question: null,
      decisionTimeout,
    });
  },
  handleMessage(
    room: Room,
    _state: AlcoholState,
    clerkId: string,
    msg: Record<string, unknown>,
  ) {
    const cs = courageStates.get(room.code);
    if (!cs || cs.playerClerkId !== clerkId) return;
    if (msg.type === "courage_choice") {
      clearTimeout(cs.decisionTimeout);
      const accept = msg.accept as boolean;
      const player = room.players.get(clerkId);
      if (!accept) {
        courageStates.delete(room.code);
        broadcast(room, {
          type: "drink_alert",
          targetClerkId: clerkId,
          emoji: "🥃",
          message: `${player?.username ?? "?"} refuse — la moitié du verre !`,
        });
        setTimeout(() => endSpecialRound(room), 4000);
        return;
      }
      const question = pickCourageQuestion(room);
      if (!question) {
        courageStates.delete(room.code);
        endSpecialRound(room);
        return;
      }
      cs.question = question;
      broadcast(room, {
        type: "courage_question",
        question: {
          type: "texte",
          text: question.text,
          category: question.category,
        },
      });
    }
    if (msg.type === "courage_answer") {
      if (!cs.question) return;
      courageStates.delete(room.code);
      const answer = msg.answer as string | boolean;
      const correct = checkAnswer(answer, cs.question);
      const player = room.players.get(clerkId);
      const game = room.game;
      let pointsDelta = 0;
      if (correct && game) {
        pointsDelta = 2;
        game.scores[clerkId] = (game.scores[clerkId] ?? 0) + 2;
      }
      broadcast(room, { type: "courage_result", correct, pointsDelta });
      if (!correct) {
        broadcast(room, {
          type: "drink_alert",
          targetClerkId: clerkId,
          emoji: "🍻",
          message: `${player?.username ?? "?"} se trompe — CUL SEC !`,
        });
      }
      setTimeout(() => endSpecialRound(room), 4000);
    }
  },
};
