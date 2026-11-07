package portfolio.casebook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Java recomputes every case from the same JSON files and must match the values the JavaScript
 * calculator wrote to cases/expected/ (to a relative error of 1e-12), so both prototypes in M2
 * work from identical estimates.
 */
class CrossLanguageTest {
    private static final Path CASES = Path.of("../cases");

    private static List<String> ids() throws IOException {
        try (Stream<Path> files = Files.list(CASES)) {
            return files.map(p -> p.getFileName().toString()).filter(n -> n.endsWith(".json") && !n.equals("defaults.json"))
                    .map(n -> n.substring(0, n.length() - 5)).sorted().toList();
        }
    }

    @TestFactory
    Stream<DynamicTest> everyCaseMatchesTheJavaScriptResults() throws IOException {
        List<String> ids = ids();
        assertEquals(12, ids.size());
        JsonMapper json = JsonMapper.builder().build();
        return ids.stream().map(id -> DynamicTest.dynamicTest(id, () -> {
            Map<String, Double> java = CaseModel.load(CASES, id).compute(Map.of());
            JsonNode js = json.readTree(Files.readString(CASES.resolve("expected").resolve(id + ".json")));
            assertEquals(js.size(), java.size(), "same number of estimates");
            for (Map.Entry<String, Double> e : java.entrySet()) {
                double expected = js.get(e.getKey()).asDouble();
                double tolerance = Math.max(Math.abs(expected) * 1e-12, 1e-12);
                assertEquals(expected, e.getValue(), tolerance, id + "." + e.getKey());
            }
        }));
    }

    @Test
    void overridesWorkAndUnknownOnesAreRefused() throws IOException {
        CaseModel url = CaseModel.load(CASES, "url-shortener");
        assertEquals(7.0, url.compute(Map.of("daily_active_users", 1e9)).get("key_length"));
        assertThrows(IllegalArgumentException.class, () -> url.compute(Map.of("dau", 1.0)));
        assertTrue(url.derived().size() > 5);
    }

    @Test
    void aMalformedMisnamedOrIncompleteCaseFileIsAClearError(@org.junit.jupiter.api.io.TempDir Path dir) throws IOException {
        Files.copy(CASES.resolve("defaults.json"), dir.resolve("defaults.json"));
        Map<String, String> files = Map.of(
                "broken", "{\"id\": \"broken\",",
                "misnamed", "{\"id\": \"other\", \"title\": \"t\", \"assumptions\": {}, \"derived\": []}",
                "untitled", "{\"id\": \"untitled\", \"assumptions\": {}, \"derived\": []}",
                "textvalue", "{\"id\": \"textvalue\", \"title\": \"t\", \"assumptions\": {\"x\": {\"value\": \"7\"}}, \"derived\": []}");
        Map<String, String> why = Map.of("broken", "not valid JSON", "misnamed", "declares id other",
                "untitled", "missing field title", "textvalue", "x must be a number");
        for (Map.Entry<String, String> f : files.entrySet()) {
            Files.writeString(dir.resolve(f.getKey() + ".json"), f.getValue());
        }
        for (String id : files.keySet()) {
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> CaseModel.load(dir, id), id);
            assertTrue(e.getMessage().contains(why.get(id)), id + ": " + e.getMessage());
        }
    }

    @Test
    void anIdCanOnlyNameACaseFileNeverAPathElsewhere() {
        for (String id : List.of("nope", "../js/package", "defaults", "URL-SHORTENER", "")) {
            IllegalArgumentException e =
                    assertThrows(IllegalArgumentException.class, () -> CaseModel.load(CASES, id), id);
            assertTrue(e.getMessage().endsWith("unknown case"), id);
        }
    }
}
