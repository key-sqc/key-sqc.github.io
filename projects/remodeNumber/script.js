class MathGame {
    constructor() {
        this.currentScreen = 'startScreen';
        this.totalQuestions = 10;
        this.timerDuration = 8;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.correctAnswers = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.questions = [];
        this.timer = null;
        this.timeLeft = 0;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('mainMenuBtn').addEventListener('click', () => this.showScreen('startScreen'));
        
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (e) => this.handleAnswer(e));
        });

        document.getElementById('questionCount').addEventListener('input', (e) => {
            let value = parseInt(e.target.value);
            if (value < 5) value = 5;
            if (value > 20) value = 20;
            e.target.value = value;
        });

        document.getElementById('timerDuration').addEventListener('change', (e) => {
            this.timerDuration = parseInt(e.target.value);
        });
    }

    startGame() {
        const questionCountInput = document.getElementById('questionCount');
        const timerDurationSelect = document.getElementById('timerDuration');
        
        this.totalQuestions = parseInt(questionCountInput.value);
        this.timerDuration = parseInt(timerDurationSelect.value);
        
        if (this.totalQuestions < 5 || this.totalQuestions > 20) {
            alert('题目数量必须在5-20之间！');
            questionCountInput.value = 10;
            this.totalQuestions = 10;
            return;
        }

        this.resetGameStats();
        this.generateQuestions();
        this.showScreen('gameScreen');
        this.showQuestion(0);
    }

    resetGameStats() {
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.correctAnswers = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.questions = [];
        this.updateScoreDisplay();
        this.updateComboDisplay();
    }

    generateQuestions() {
        for (let i = 0; i < this.totalQuestions; i++) {
            const isAddition = Math.random() > 0.5;
            let num1, num2, answer;
            
            if (isAddition) {
                num1 = Math.floor(Math.random() * 50) + 10;
                num2 = Math.floor(Math.random() * 50) + 10;
                answer = num1 + num2;
            } else {
                num1 = Math.floor(Math.random() * 50) + 30;
                num2 = Math.floor(Math.random() * 29) + 1;
                answer = num1 - num2;
            }

            const operator = isAddition ? '+' : '-';
            const question = `${num1} ${operator} ${num2} = ?`;
            
            const options = this.generateOptions(answer);
            
            this.questions.push({
                question,
                answer,
                options,
                userAnswer: null,
                isCorrect: false
            });
        }
    }

    generateOptions(correctAnswer) {
        const options = [correctAnswer];
        
        while (options.length < 4) {
            let wrongAnswer;
            const variance = Math.floor(Math.random() * 15) + 5;
            const isPositive = Math.random() > 0.5;
            
            if (isPositive) {
                wrongAnswer = correctAnswer + variance;
            } else {
                wrongAnswer = Math.max(1, correctAnswer - variance);
            }
            
            if (!options.includes(wrongAnswer) && wrongAnswer !== correctAnswer) {
                options.push(wrongAnswer);
            }
        }
        
        return this.shuffleArray(options);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    showQuestion(index) {
        if (index >= this.questions.length) {
            this.endGame();
            return;
        }

        this.currentQuestionIndex = index;
        const question = this.questions[index];
        
        document.getElementById('question').textContent = question.question;
        document.getElementById('question').className = 'question';
        document.getElementById('progress').textContent = `题目 ${index + 1}/${this.totalQuestions}`;
        
        const options = document.querySelectorAll('.option');
        options.forEach((option, i) => {
            const optionText = option.querySelector('.option-text');
            optionText.textContent = question.options[i];
            option.className = 'option';
            option.dataset.index = i;
        });
        
        const feedback = document.getElementById('feedback');
        feedback.innerHTML = '<div class="feedback-text">选择答案...</div>';
        feedback.className = 'feedback';
        
        this.showQuestionHint();
        this.updateGameBackground(index);
        this.startTimer();
    }

    showQuestionHint() {
        const hint = document.getElementById('questionHint');
        const hints = [
            "快速思考！时间在流逝...",
            "相信你的直觉！",
            "集中注意力！",
            "你能做到的！",
            "保持连击！"
        ];
        hint.textContent = hints[Math.floor(Math.random() * hints.length)];
        hint.className = 'question-hint show';
        
        setTimeout(() => {
            hint.className = 'question-hint';
        }, 2000);
    }

    updateGameBackground(questionIndex) {
        const background = document.getElementById('gameBackground');
        const progress = questionIndex / this.totalQuestions;
        
        const hue = 220 + (progress * 40);
        const saturation = 70 + (progress * 10);
        const lightness = 15 + (progress * 5);
        
        background.style.background = `linear-gradient(135deg, 
            hsl(${hue}, ${saturation}%, ${lightness}%), 
            hsl(${hue + 20}, ${saturation}%, ${lightness}%))`;
    }

    startTimer() {
        this.timeLeft = this.timerDuration;
        this.updateTimerBar();
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerBar();
            
            if (this.timeLeft <= 0) {
                this.handleTimeUp();
            }
        }, 1000);
    }

    updateTimerBar() {
        const timerBar = document.getElementById('timerBar');
        const percentage = (this.timeLeft / this.timerDuration) * 100;
        
        timerBar.style.width = `${percentage}%`;
        
        timerBar.className = 'timer-bar';
        if (percentage < 30) {
            timerBar.classList.add('danger');
        } else if (percentage < 60) {
            timerBar.classList.add('warning');
        }
    }

    handleTimeUp() {
        clearInterval(this.timer);
        const currentQuestion = this.questions[this.currentQuestionIndex];
        currentQuestion.userAnswer = null;
        currentQuestion.isCorrect = false;
        
        this.combo = 0;
        this.updateComboDisplay();
        this.showFeedback('时间到！', 'wrong');
        this.createParticles('danger');
        
        setTimeout(() => {
            this.showQuestion(this.currentQuestionIndex + 1);
        }, 1500);
    }

    handleAnswer(event) {
        clearInterval(this.timer);
        
        const selectedIndex = parseInt(event.currentTarget.dataset.index);
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const selectedValue = currentQuestion.options[selectedIndex];
        const isCorrect = selectedValue === currentQuestion.answer;
        
        currentQuestion.userAnswer = selectedValue;
        currentQuestion.isCorrect = isCorrect;
        
        const options = document.querySelectorAll('.option');
        options.forEach((option, i) => {
            const value = currentQuestion.options[i];
            if (value === currentQuestion.answer) {
                option.classList.add('correct');
            } else if (i === selectedIndex && !isCorrect) {
                option.classList.add('wrong');
            }
        });
        
        if (isCorrect) {
            this.handleCorrectAnswer();
        } else {
            this.handleWrongAnswer();
        }
        
        setTimeout(() => {
            this.showQuestion(this.currentQuestionIndex + 1);
        }, 1500);
    }

    handleCorrectAnswer() {
        this.correctAnswers++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        
        const baseScore = 100;
        const timeBonus = Math.floor((this.timeLeft / this.timerDuration) * 50);
        const comboBonus = this.combo * 20;
        const questionScore = baseScore + timeBonus + comboBonus;
        
        this.score += questionScore;
        
        this.showScorePopup(`+${questionScore}`);
        this.showFeedback(`完美！连击 x${this.combo}`, 'correct');
        this.updateScoreDisplay();
        this.updateComboDisplay();
        this.createParticles('success');
        this.animateQuestion('correct');
    }

    handleWrongAnswer() {
        this.combo = 0;
        this.showFeedback('错误！连击中断', 'wrong');
        this.updateComboDisplay();
        this.createParticles('danger');
        this.animateQuestion('wrong');
    }

    showScorePopup(scoreText) {
        const popup = document.getElementById('scorePopup');
        popup.textContent = scoreText;
        popup.style.animation = 'none';
        void popup.offsetWidth; // 触发重绘
        popup.style.animation = 'scorePopup 1s ease-out forwards';
    }

    createParticles(type) {
        const container = document.getElementById('particlesContainer');
        const color = type === 'success' ? '#4ade80' : '#f87171';
        const count = type === 'success' ? 15 : 8;
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.background = color;
            particle.style.left = '50%';
            particle.style.top = '50%';
            
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 100;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            
            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);
            
            container.appendChild(particle);
            
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }

    animateQuestion(type) {
        const question = document.getElementById('question');
        question.classList.add(type);
        setTimeout(() => {
            question.classList.remove(type);
        }, 600);
    }

    showFeedback(message, type) {
        const feedback = document.getElementById('feedback');
        feedback.innerHTML = `<div class="feedback-text">${message}</div>`;
        feedback.className = `feedback ${type}`;
    }

    updateScoreDisplay() {
        document.getElementById('score').textContent = `得分: ${this.score}`;
    }

    updateComboDisplay() {
        const comboDisplay = document.getElementById('comboDisplay');
        const comboCount = comboDisplay.querySelector('.combo-count');
        
        if (this.combo > 1) {
            comboDisplay.classList.add('active');
            comboCount.textContent = `x${this.combo}`;
            comboDisplay.style.background = `rgba(245, 158, 11, ${0.7 + this.combo * 0.05})`;
        } else {
            comboDisplay.classList.remove('active');
        }
    }

    endGame() {
        this.showScreen('endScreen');
        
        const accuracy = Math.round((this.correctAnswers / this.totalQuestions) * 100);
        
        document.getElementById('correctCount').textContent = 
            `${this.correctAnswers}/${this.totalQuestions}`;
        document.getElementById('finalScoreDisplay').textContent = this.score;
        document.getElementById('maxCombo').textContent = this.maxCombo;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        
        this.updatePerformanceComment(accuracy);
    }

    updatePerformanceComment(accuracy) {
        const performanceText = document.getElementById('performanceText');
        let comment = '';
        
        if (accuracy === 100) {
            comment = '🎯 完美无缺！你是数学天才！';
        } else if (accuracy >= 90) {
            comment = '🌟 惊人的表现！非常出色！';
        } else if (accuracy >= 80) {
            comment = '💪 优秀的成绩！继续保持！';
        } else if (accuracy >= 70) {
            comment = '👍 不错的表现！还有提升空间！';
        } else if (accuracy >= 60) {
            comment = '📚 及格了！多加练习会更好！';
        } else {
            comment = '🎓 需要更多练习，相信下次会更好！';
        }
        
        performanceText.textContent = comment;
    }

    restartGame() {
        this.startGame();
    }

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenName).classList.add('active');
        this.currentScreen = screenName;
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new MathGame();
});