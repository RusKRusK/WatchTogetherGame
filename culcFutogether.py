import sys
from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QComboBox, QSpinBox, QTextEdit, QMessageBox
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

# 以前作成した計算ロジックをそのまま流用します
def calculate_watch_futogether_scores(players, parent, submissions, child_guesses, parent_guesses):
    """Watch Futogetherの1ラウンド分の得点を計算します。"""
    # ... (計算ロジック部分は前回の回答と同じなので、ここでは省略します)
    # ... (実際のコードでは、この場所に計算関数をペーストしてください)
    scores = {player: 0 for player in players}
    children = [p for p in players if p != parent]
    
    # 計算過程をテキストで返すように少し変更
    log_text = "--- 得点計算開始 ---\n"
    
    # ルール6
    log_text += "\n[ルール6：子の予想 と 得票数ポイント]\n"
    parent_video = submissions[parent]
    correct_guessers_count = 0
    for child in children:
        if child_guesses.get(child) == parent_video:
            scores[child] += 10
            correct_guessers_count += 1
            log_text += f"  ✅ 子 {child} は的中！ +10点\n"

    vote_counts = {video: 0 for video in submissions.values()}
    for guessed_video in child_guesses.values():
        if guessed_video in vote_counts:
            vote_counts[guessed_video] += 1
            
    all_children_guessed_correctly = (correct_guessers_count == len(children))
    
    for player in players:
        player_video = submissions[player]
        votes_for_player_video = vote_counts.get(player_video, 0)
        
        if votes_for_player_video > 0:
            if player == parent and all_children_guessed_correctly and children:
                log_text += f"  ⚠️ 親 {parent} の動画は子全員に的中されたため、得票数ポイントは獲得できません。\n"
                continue
            points_from_votes = votes_for_player_video * 5
            scores[player] += points_from_votes
            log_text += f"  🗳️ {player}さんの動画 ({player_video}) は {votes_for_player_video} 票獲得！ +{points_from_votes}点\n"

    # ルール7
    log_text += "\n[ルール7：親の紐付け予想ポイント]\n"
    parent_correct_matches = 0
    if parent_guesses:
        for video, guessed_child in parent_guesses.items():
            actual_submitter = next((p for p, v in submissions.items() if v == video), None)
            if actual_submitter == guessed_child:
                parent_correct_matches += 1
                log_text += f"  ✅ 親 {parent} は「{video}は{guessed_child}さんが選んだ」と見抜き、的中！\n"

    if parent_correct_matches > 0:
        parent_bonus = parent_correct_matches * 5
        scores[parent] += parent_bonus
        log_text += f"  ➡️ 親 {parent} は {parent_correct_matches} 人の紐付けに成功！ +{parent_bonus}点\n"
    else:
        log_text += "  ➡️ 親 {parent} の紐付け予想は的中しませんでした。\n"
        
    log_text += "\n--- 得点計算終了 ---\n"
    
    # 最終スコアのテキストを追加
    log_text += "\n【このラウンドの最終スコア】\n"
    sorted_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    for player, score in sorted_scores:
        log_text += f"  {player}: {score}点\n"
        
    return log_text

class PlayerSetupDialog(QWidget):
    """プレイヤーの人数と名前を設定する初期ウィンドウ（修正版）"""
    def __init__(self):
        super().__init__()
        self.player_inputs = []
        self.main_window = None # メインウィンドウを保持する変数を追加
        self.initUI()

    def initUI(self):
        self.setWindowTitle('Watch Futogether - プレイヤー設定')
        self.layout = QVBoxLayout()

        # 人数設定
        setup_layout = QHBoxLayout()
        setup_layout.addWidget(QLabel('プレイヤー人数:'))
        self.num_players_spinbox = QSpinBox()
        self.num_players_spinbox.setMinimum(2)
        self.num_players_spinbox.setValue(3)
        self.num_players_spinbox.valueChanged.connect(self.create_player_inputs)
        setup_layout.addWidget(self.num_players_spinbox)
        self.layout.addLayout(setup_layout)
        
        # 名前入力欄のコンテナ
        self.names_container = QVBoxLayout()
        self.layout.addLayout(self.names_container)

        # 確定ボタン
        self.confirm_button = QPushButton('プレイヤーを確定して次へ')
        self.confirm_button.clicked.connect(self.confirm_players)
        self.layout.addWidget(self.confirm_button)

        self.setLayout(self.layout)
        self.create_player_inputs()

    def create_player_inputs(self):
        # 修正箇所：レイアウト内のウィジェットを安全に削除する
        while self.names_container.count():
            layout_item = self.names_container.takeAt(0)
            if layout_item.widget():
                layout_item.widget().setParent(None)
            # ネストされたレイアウト（行ごとのQHBoxLayout）もクリアする
            elif layout_item.layout():
                while layout_item.layout().count():
                    nested_item = layout_item.layout().takeAt(0)
                    if nested_item.widget():
                        nested_item.widget().setParent(None)
        
        self.player_inputs.clear()

        # 新しい入力欄を作成
        num_players = self.num_players_spinbox.value()
        for i in range(num_players):
            label = QLabel(f'プレイヤー {i+1} の名前:')
            line_edit = QLineEdit()
            self.player_inputs.append(line_edit)
            row = QHBoxLayout()
            row.addWidget(label)
            row.addWidget(line_edit)
            self.names_container.addLayout(row)

    def confirm_players(self):
        players = [inp.text().strip() for inp in self.player_inputs]
        if any(not p for p in players):
            QMessageBox.warning(self, 'エラー', 'すべてのプレイヤー名を入力してください。')
            return
        if len(set(players)) != len(players):
            QMessageBox.warning(self, 'エラー', 'プレイヤー名が重複しています。')
            return
            
        # 既存のウィンドウを閉じてから新しいウィンドウを開く
        if self.main_window is not None:
            self.main_window.close()

        self.main_window = MainWindow(players)
        self.main_window.show()
        self.close()

class MainWindow(QWidget):
    """メインのスコア計算ウィンドウ"""
    def __init__(self, players):
        super().__init__()
        self.players = players
        self.children = []
        
        # ウィジェットを保持する辞書
        self.submission_inputs = {}
        self.child_guess_combos = {}
        self.parent_guess_combos = {}
        
        self.initUI()

    def initUI(self):
        self.setWindowTitle('Watch Futogether - 得点計算')
        self.setGeometry(100, 100, 600, 700)
        
        main_layout = QVBoxLayout()
        grid = QGridLayout()
        grid.setSpacing(10)

        # 1. 親の選択
        grid.addWidget(QLabel('<b>1. 親の選択</b>'), 0, 0)
        self.parent_combo = QComboBox()
        self.parent_combo.addItems(self.players)
        self.parent_combo.currentIndexChanged.connect(self.setup_round)
        grid.addWidget(self.parent_combo, 0, 1)

        # 2. 動画の提出
        grid.addWidget(QLabel('<b>2. 各プレイヤーの提出動画</b>'), 1, 0, 1, 2)
        self.submission_layout = QGridLayout()
        grid.addLayout(self.submission_layout, 2, 0, 1, 2)
        
        # 3. 子の予想
        grid.addWidget(QLabel('<b>3. 子の予想（親の動画はどれ？）</b>'), 3, 0, 1, 2)
        self.child_guess_layout = QGridLayout()
        grid.addLayout(self.child_guess_layout, 4, 0, 1, 2)
        
        # 4. 親の予想
        grid.addWidget(QLabel('<b>4. 親の予想（誰がどの動画を選んだ？）</b>'), 5, 0, 1, 2)
        self.parent_guess_layout = QGridLayout()
        grid.addLayout(self.parent_guess_layout, 6, 0, 1, 2)

        main_layout.addLayout(grid)
        
        # 計算ボタン
        self.calc_button = QPushButton('得点を計算する')
        self.calc_button.setFont(QFont('System', 12, QFont.Bold))
        self.calc_button.clicked.connect(self.on_calculate)
        main_layout.addWidget(self.calc_button)

        # 結果表示エリア
        self.result_area = QTextEdit()
        self.result_area.setReadOnly(True)
        self.result_area.setFont(QFont('Monospace', 10))
        main_layout.addWidget(self.result_area)

        self.setLayout(main_layout)
        self.setup_round() # 初期設定を呼び出し

    def clear_layout(self, layout):
        """レイアウト内のウィジェットをすべて削除する"""
        if layout is not None:
            while layout.count():
                item = layout.takeAt(0)
                widget = item.widget()
                if widget is not None:
                    widget.deleteLater()

    def setup_round(self):
        """親が選択されたときにUIを再構築する"""
        parent = self.parent_combo.currentText()
        self.children = [p for p in self.players if p != parent]

        # 各レイアウトをクリア
        self.clear_layout(self.submission_layout)
        self.clear_layout(self.child_guess_layout)
        self.clear_layout(self.parent_guess_layout)
        self.submission_inputs.clear()
        self.child_guess_combos.clear()
        self.parent_guess_combos.clear()

        # 2. 動画提出欄を作成
        for i, player in enumerate(self.players):
            label = QLabel(f'{player} さんの動画:')
            line_edit = QLineEdit()
            line_edit.textChanged.connect(self.update_guess_options)
            self.submission_inputs[player] = line_edit
            self.submission_layout.addWidget(label, i, 0)
            self.submission_layout.addWidget(line_edit, i, 1)

        # 3. 子の予想欄を作成
        for i, child in enumerate(self.children):
            label = QLabel(f'{child} さんの予想:')
            combo = QComboBox()
            self.child_guess_combos[child] = combo
            self.child_guess_layout.addWidget(label, i, 0)
            self.child_guess_layout.addWidget(combo, i, 1)

        # 4. 親の予想欄を作成（この時点では空）
        self.update_guess_options()

    def update_guess_options(self):
        """動画名が入力されたら、予想の選択肢を更新する"""
        submitted_videos = [inp.text().strip() for inp in self.submission_inputs.values() if inp.text().strip()]
        
        # 子の予想コンボボックスを更新
        for combo in self.child_guess_combos.values():
            current_selection = combo.currentText()
            combo.clear()
            combo.addItem('') # 空の選択肢
            combo.addItems(submitted_videos)
            if current_selection in submitted_videos:
                combo.setCurrentText(current_selection)

        # 親の予想欄を再構築
        self.clear_layout(self.parent_guess_layout)
        self.parent_guess_combos.clear()
        child_videos = [self.submission_inputs[c].text().strip() for c in self.children if self.submission_inputs[c].text().strip()]
        
        for i, video in enumerate(child_videos):
            label = QLabel(f'動画「{video}」は誰？:')
            combo = QComboBox()
            combo.addItem('') # 空の選択肢
            combo.addItems(self.children)
            self.parent_guess_combos[video] = combo
            self.parent_guess_layout.addWidget(label, i, 0)
            self.parent_guess_layout.addWidget(combo, i, 1)

    def on_calculate(self):
        # データ収集
        try:
            parent = self.parent_combo.currentText()
            submissions = {p: i.text().strip() for p, i in self.submission_inputs.items()}
            if any(not v for v in submissions.values()):
                raise ValueError("すべてのプレイヤーが動画を提出してください。")

            child_guesses = {c: co.currentText() for c, co in self.child_guess_combos.items()}
            if any(not g for g in child_guesses.values()):
                raise ValueError("すべての子が親の動画を予想してください。")

            parent_guesses = {v: co.currentText() for v, co in self.parent_guess_combos.items()}
            if any(not g for g in parent_guesses.values()):
                raise ValueError("親はすべての動画の提出者を予想してください。")
        except ValueError as e:
            QMessageBox.warning(self, '入力エラー', str(e))
            return
        except Exception:
             QMessageBox.warning(self, 'エラー', '入力データに不備があります。')
             return

        # 計算実行
        result_log = calculate_watch_futogether_scores(
            self.players, parent, submissions, child_guesses, parent_guesses
        )
        
        # 結果表示
        self.result_area.setText(result_log)


if __name__ == '__main__':
    app = QApplication(sys.argv)
    # まずプレイヤー設定ウィンドウを起動
    setup_dialog = PlayerSetupDialog()
    setup_dialog.show()
    sys.exit(app.exec_())