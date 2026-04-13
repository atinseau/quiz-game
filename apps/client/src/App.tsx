import { useGameState } from "./hooks/useGameState";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { EndScreen } from "./components/EndScreen";

export function App() {
  const game = useGameState();

  if (game.screen === "home") {
    return (
      <HomeScreen
        players={game.players}
        selectedChunk={game.selectedChunk}
        onAddPlayer={game.addPlayer}
        onRemovePlayer={game.removePlayer}
        onSelectChunk={game.setSelectedChunk}
        onStart={game.startGame}
      />
    );
  }

  if (game.screen === "game" && game.currentQuestion) {
    return (
      <GameScreen
        currentQuestion={game.currentQuestion}
        currentQuestionIndex={game.currentQuestionIndex}
        currentPlayerIndex={game.currentPlayerIndex}
        currentPlayer={game.currentPlayer}
        totalQuestions={game.totalQuestions}
        players={game.players}
        scores={game.scores}
        combos={game.combos}
        isSolo={game.isSolo}
        answered={game.answered}
        blindMode={game.blindMode}
        feedback={game.feedback}
        showForceBtn={game.showForceBtn}
        stealConfirmMode={game.stealConfirmMode}
        canSteal={game.canSteal}
        gameMode={game.gameMode}
        timeLeft={game.timeLeft}
        onSubmitAnswer={game.submitAnswer}
        onSubmitBlind={game.submitBlindAnswer}
        onRevealChoices={game.revealChoices}
        onSteal={game.initiateSteal}
        onConfirmSteal={game.confirmSteal}
        onForcePoint={game.forcePoint}
        onNextQuestion={game.nextQuestion}
        onReset={game.resetGame}
      />
    );
  }

  if (game.screen === "end") {
    return (
      <EndScreen
        players={game.players}
        scores={game.scores}
        totalQuestions={game.totalQuestions}
        onReset={game.resetGame}
      />
    );
  }

  return null;
}
