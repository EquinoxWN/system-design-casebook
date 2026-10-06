package portfolio.casebook;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** One case loaded from cases/*.json (with cases/defaults.json) and computed in order. */
public final class CaseModel {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    /** A derived estimate. */
    public record Derived(String name, String label, String unit, Formula formula) {
    }

    private final String id;
    private final String title;
    private final Map<String, Double> assumptions = new LinkedHashMap<>();
    private final List<Derived> derived = new ArrayList<>();

    private CaseModel(String id, String title) {
        this.id = id;
        this.title = title;
    }

    /** Load a case by id from a cases directory. */
    public static CaseModel load(Path casesDir, String id) throws java.io.IOException {
        // Only names of files in the cases folder: an id can never become a path elsewhere.
        if (!id.matches("[a-z0-9-]{1,64}") || id.equals("defaults") || !Files.isRegularFile(casesDir.resolve(id + ".json"))) {
            throw new IllegalArgumentException("case " + id + ": unknown case");
        }
        JsonNode defaults = JSON.readTree(Files.readString(casesDir.resolve("defaults.json")));
        JsonNode c = JSON.readTree(Files.readString(casesDir.resolve(id + ".json")));
        if (!id.equals(c.get("id").asString())) {
            throw new IllegalArgumentException("case " + id + " declares id " + c.get("id").asString());
        }
        CaseModel model = new CaseModel(id, c.get("title").asString());
        for (JsonNode source : List.of(defaults.get("assumptions"), c.get("assumptions"))) {
            for (Map.Entry<String, JsonNode> e : source.properties()) {
                model.assumptions.put(e.getKey(), e.getValue().get("value").asDouble());
            }
        }
        for (JsonNode d : c.get("derived")) {
            model.derived.add(new Derived(d.get("name").asString(), d.get("label").asString(), d.get("unit").asString(),
                    Formula.parse(d.get("formula").asString())));
        }
        return model;
    }

    /** Every derived value, in definition order; overrides replace assumption values. */
    public Map<String, Double> compute(Map<String, Double> overrides) {
        Map<String, Double> env = new LinkedHashMap<>(assumptions);
        overrides.forEach((k, v) -> {
            if (!env.containsKey(k)) {
                throw new IllegalArgumentException("cannot override unknown assumption " + k);
            }
            env.put(k, v);
        });
        Map<String, Double> out = new LinkedHashMap<>();
        for (Derived d : derived) {
            double v = d.formula().evaluate(env);
            env.put(d.name(), v);
            out.put(d.name(), v);
        }
        return out;
    }

    public String id() {
        return id;
    }

    public String title() {
        return title;
    }

    public List<Derived> derived() {
        return List.copyOf(derived);
    }
}
