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
        JsonNode defaults = read(casesDir.resolve("defaults.json"), id);
        JsonNode c = read(casesDir.resolve(id + ".json"), id);
        String declared = text(c, "id", id);
        if (!id.equals(declared)) {
            throw new IllegalArgumentException("case " + id + " declares id " + declared);
        }
        CaseModel model = new CaseModel(id, text(c, "title", id));
        for (JsonNode source : List.of(field(defaults, "assumptions", id), field(c, "assumptions", id))) {
            for (Map.Entry<String, JsonNode> e : source.properties()) {
                JsonNode value = field(e.getValue(), "value", id);
                if (!value.isNumber()) {
                    throw new IllegalArgumentException("case " + id + ": " + e.getKey() + " must be a number");
                }
                model.assumptions.put(e.getKey(), value.asDouble());
            }
        }
        JsonNode derived = field(c, "derived", id);
        if (!derived.isArray()) {
            throw new IllegalArgumentException("case " + id + ": derived must be a list");
        }
        for (JsonNode d : derived) {
            model.derived.add(new Derived(text(d, "name", id), text(d, "label", id), text(d, "unit", id),
                    Formula.parse(text(d, "formula", id))));
        }
        return model;
    }

    /** Parse a JSON file; malformed JSON is an IllegalArgumentException naming the case. */
    private static JsonNode read(Path file, String id) throws java.io.IOException {
        try {
            return JSON.readTree(Files.readString(file));
        } catch (tools.jackson.core.JacksonException e) {
            throw new IllegalArgumentException("case " + id + ": " + file.getFileName() + " is not valid JSON", e);
        }
    }

    /** A required member of an object. */
    private static JsonNode field(JsonNode node, String name, String id) {
        JsonNode v = node == null ? null : node.get(name);
        if (v == null || v.isNull()) {
            throw new IllegalArgumentException("case " + id + ": missing field " + name);
        }
        return v;
    }

    /** A required text member of an object. */
    private static String text(JsonNode node, String name, String id) {
        JsonNode v = field(node, name, id);
        if (!v.isString()) {
            throw new IllegalArgumentException("case " + id + ": " + name + " must be text");
        }
        return v.asString();
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
