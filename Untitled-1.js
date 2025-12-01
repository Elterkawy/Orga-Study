
            <!-- Calculatrice -->
            <div id="calculator" class="tool-box">
                <h3>Calculatrice</h3>
                <input type="text" id="calc-input" placeholder="0" />
                <div>
                    <button class="calc-btn">1</button>
                    <button class="calc-btn">2</button>
                    <button class="calc-btn">3</button>
                    <button class="calc-btn">+</button>
                    <button class="calc-btn">4</button>
                    <button class="calc-btn">5</button>
                    <button class="calc-btn">6</button>
                    <button class="calc-btn">-</button>
                    <button class="calc-btn">7</button>
                    <button class="calc-btn">8</button>
                    <button class="calc-btn">9</button>
                    <button class="calc-btn">*</button>
                    <button class="calc-btn">0</button>
                    <button id="calc-equal">=</button>
                    <button class="calc-btn">C</button>
                    <button class="calc-btn">/</button>
                </div>
            </div>
        </section>




        // ============ TOOLS: CALCULATOR ============
    const calcInput = document.getElementById('calc-input');
    document.querySelectorAll('.calc-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (!calcInput) return;
            if (button.textContent === 'C') {
                calcInput.value = '';
            } else {
                calcInput.value += button.textContent;
            }
        });
    });

    document.getElementById('calc-equal')?.addEventListener('click', () => {
        if (!calcInput) return;
        try {
            const expr = calcInput.value.replace(/[^0-9+\-*/().%\s]/g, '');
            // eslint-disable-next-line no-new-func
            const res = Function(`return (${expr})`)();
            calcInput.value = String(res);
        } catch (e) {
            calcInput.value = 'Erreur';
        }
    });