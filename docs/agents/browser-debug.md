# Debug no browser

Dois sintomas que parecem bug do código e não são.

## Scroll-spy ou reveal parado

O IntersectionObserver não dispara em aba `hidden`: o Chromium pausa o loop de render com a janela em segundo plano ou coberta. Sob automação pelo claude-in-chrome, com o Brave atrás de outras janelas, o scroll-spy parece quebrado.

1. Leia `document.visibilityState` antes de culpar o código.
2. Traga a janela do Brave para a frente antes de medir.

## Cor errada na tela com `getComputedStyle` certo

Meça o pixel real antes de culpar o browser. Não assuma force-dark, extensão ou `color-scheme`.

1. Desenhe o elemento num `<canvas>` (`drawImage` e `getImageData`) e leia o pixel. O resultado diz se o bug está nos dados (a imagem já vem com a cor) ou na composição.
2. Valide cedo fora do perfil com extensões. Peça ao dono uma janela limpa, porque o claude-in-chrome só dirige o Brave dele.
3. Trocar `img.src` por JS não prova nada, porque o reprocessamento é inconsistente. Só `reload` real ou canvas valem.

O Auto Dark Theme do Chromium liga com o sistema em modo escuro, sem flag. O `color-scheme: light` em `globals.css` impede.
