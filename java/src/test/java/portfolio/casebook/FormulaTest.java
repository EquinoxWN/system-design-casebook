package portfolio.casebook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class FormulaTest {

    private static double calc(String f, Map<String, Double> env) {
        return Formula.parse(f).evaluate(env);
    }

    @Test
    void hugeOrDeeplyNestedFormulasAreRefusedWithoutOverflowingTheStack() {
        int over = Formula.MAX_DEPTH + 1;
        String parens = "(".repeat(over) + "1" + ")".repeat(over);
        assertTrue(assertThrows(Formula.FormulaException.class, () -> Formula.parse(parens)).getMessage()
                .contains("nested"));
        assertTrue(assertThrows(Formula.FormulaException.class, () -> Formula.parse("-".repeat(over) + "1"))
                .getMessage().contains("nested"));
        String longSum = "1+".repeat(Formula.MAX_LENGTH) + "1";
        assertTrue(assertThrows(Formula.FormulaException.class, () -> Formula.parse(longSum)).getMessage()
                .contains("longer than"));
        assertEquals(2.0, calc("(".repeat(50) + "2" + ")".repeat(50), Map.of()));
    }

    @Test
    void precedenceAssociativityAndFunctionsMatchTheJavaScriptCalculator() {
        assertEquals(7, calc("1 + 2 * 3", Map.of()));
        assertEquals(3, calc("10 - 4 - 3", Map.of()));
        assertEquals(2, calc("100 / 10 / 5", Map.of()));
        assertEquals(6, calc("-2 * -3", Map.of()));
        assertEquals(1500.2, calc("1.5e3 + 2E-1", Map.of()));
        assertEquals(8, calc("ceil(2.1) + floor(2.9) + round(2.5)", Map.of()));
        assertEquals(6, calc("ceil(log(36500000000, 62))", Map.of()));
        assertEquals(500_000, calc("users * per_user", Map.of("users", 1e6, "per_user", 0.5)));
        assertEquals(Set.of("a", "b", "c"), Formula.parse("ceil(a / (b * c)) + a").names());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            1 +              | unexpected end
            (1 + 2           | expected ')'
            1 2              | unexpected '2'
            users * 2        | unknown name 'users'
            sqrt(4)          | unknown function 'sqrt'
            min(1)           | takes 2 argument
            1 / 0            | division by zero
            log(0, 10)       | not a finite number
            process.exit(1)  | unexpected character
            """)
    void brokenFormulasFailClearly(String formula, String why) {
        Formula.FormulaException e = assertThrows(Formula.FormulaException.class, () -> calc(formula, Map.of()));
        assertTrue(e.getMessage().contains(why), e.getMessage());
    }
}
