package com.masplatform.template;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.masplatform.workflow.Workflow;
import com.masplatform.workflow.WorkflowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TemplateService implements ApplicationRunner {

    private final TemplateRepository   templateRepo;
    private final WorkflowRepository   workflowRepo;
    private final ObjectMapper         objectMapper;

    // ── Public API ────────────────────────────────────────────────────────────

    public List<TemplateDto> list(String category) {
        List<Template> results = category != null && !category.isBlank()
                ? templateRepo.findByCategoryOrderByNameAsc(category)
                : templateRepo.findAllByOrderByCategoryAscNameAsc();
        return results.stream().map(this::toDto).toList();
    }

    public TemplateDto get(UUID id) {
        return templateRepo.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @Transactional
    public TemplateDto saveAsTemplate(UUID workflowId, UUID userId,
                                      String name, String description, String category) {
        Workflow w = workflowRepo.findByIdAndUserId(workflowId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        Template t = Template.builder()
                .name(name != null && !name.isBlank() ? name : w.getName())
                .description(description != null ? description : w.getDescription())
                .category(category)
                .orchestrationType(w.getOrchestrationType())
                .graphJson(w.getGraphJson())
                .yamlContent(w.getYamlContent())
                .isBuiltin(false)
                .createdBy(userId)
                .build();

        return toDto(templateRepo.save(t));
    }

    // ── Seeder ────────────────────────────────────────────────────────────────

    @Override
    public void run(ApplicationArguments args) {
        if (templateRepo.existsByIsBuiltinTrue()) return;
        log.info("Seeding built-in templates…");
        seedBuiltins();
    }

    private void seedBuiltins() {
        save("Customer Support", "support",
                "Triage and respond to customer support tickets with a two-agent sequential pipeline.",
                "sequential",
                customerSupportGraph(),
                customerSupportYaml());

        save("Deep Research", "research",
                "Orchestrate a research team with a coordinator, researcher, and synthesizer.",
                "magentic",
                deepResearchGraph(),
                deepResearchYaml());

        save("Marketing Campaign", "marketing",
                "Run social media, blog, and email content generation in parallel.",
                "concurrent",
                marketingGraph(),
                marketingYaml());
    }

    private void save(String name, String category, String description,
                      String orchType, Map<String, Object> graph, String yaml) {
        try {
            templateRepo.save(Template.builder()
                    .name(name)
                    .description(description)
                    .category(category)
                    .orchestrationType(orchType)
                    .graphJson(graph)
                    .yamlContent(yaml)
                    .isBuiltin(true)
                    .build());
        } catch (Exception e) {
            log.error("Failed to seed template '{}': {}", name, e.getMessage());
        }
    }

    private Map<String, Object> parse(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Bad template JSON", e);
        }
    }

    // ── Customer Support graph ────────────────────────────────────────────────

    private Map<String, Object> customerSupportGraph() {
        return parse("""
            {
              "nodes": [
                {"id":"start_1","type":"start","position":{"x":60,"y":200},"data":{}},
                {"id":"agent_1","type":"agent","position":{"x":220,"y":200},"data":{"alias":"triage","agentName":"Triage Agent","instructions":"Classify and route incoming customer support tickets by urgency and topic."}},
                {"id":"agent_2","type":"agent","position":{"x":440,"y":200},"data":{"alias":"response","agentName":"Response Agent","instructions":"Draft empathetic, accurate responses to customer questions."}},
                {"id":"end_1","type":"end","position":{"x":660,"y":200},"data":{}}
              ],
              "edges": [
                {"id":"e1","source":"start_1","target":"agent_1","animated":true},
                {"id":"e2","source":"agent_1","target":"agent_2","animated":true},
                {"id":"e3","source":"agent_2","target":"end_1","animated":true}
              ]
            }
            """);
    }

    private String customerSupportYaml() {
        return """
                orchestration_type: sequential
                name: Customer Support

                agents:
                - id: triage
                  ref: ""
                  alias: triage
                  instructions: "Classify and route incoming customer support tickets by urgency and topic."
                  next: response
                - id: response
                  ref: ""
                  alias: response
                  instructions: "Draft empathetic, accurate responses to customer questions."
                """;
    }

    // ── Deep Research graph ───────────────────────────────────────────────────

    private Map<String, Object> deepResearchGraph() {
        return parse("""
            {
              "nodes": [
                {"id":"start_1","type":"start","position":{"x":60,"y":250},"data":{}},
                {"id":"agent_1","type":"agent","position":{"x":240,"y":250},"data":{"alias":"orchestrator","agentName":"Research Orchestrator","instructions":"Coordinate the research team, delegate tasks, and compile the final report."}},
                {"id":"agent_2","type":"agent","position":{"x":460,"y":140},"data":{"alias":"researcher","agentName":"Researcher","instructions":"Search multiple sources and gather comprehensive data on the topic."}},
                {"id":"agent_3","type":"agent","position":{"x":460,"y":360},"data":{"alias":"synthesizer","agentName":"Synthesizer","instructions":"Analyze research findings and produce a concise, structured summary."}},
                {"id":"end_1","type":"end","position":{"x":680,"y":250},"data":{}}
              ],
              "edges": [
                {"id":"e1","source":"start_1","target":"agent_1","animated":true},
                {"id":"e2","source":"agent_1","target":"agent_2","animated":true},
                {"id":"e3","source":"agent_1","target":"agent_3","animated":true},
                {"id":"e4","source":"agent_2","target":"end_1","animated":true},
                {"id":"e5","source":"agent_3","target":"end_1","animated":true}
              ]
            }
            """);
    }

    private String deepResearchYaml() {
        return """
                orchestration_type: magentic
                name: Deep Research

                orchestrator:
                  ref: ""
                  alias: orchestrator

                team:
                - ref: ""
                  alias: researcher
                  instructions: "Search multiple sources and gather comprehensive data on the topic."
                - ref: ""
                  alias: synthesizer
                  instructions: "Analyze research findings and produce a concise, structured summary."
                """;
    }

    // ── Marketing graph ───────────────────────────────────────────────────────

    private Map<String, Object> marketingGraph() {
        return parse("""
            {
              "nodes": [
                {"id":"start_1","type":"start","position":{"x":60,"y":260},"data":{}},
                {"id":"agent_1","type":"agent","position":{"x":260,"y":100},"data":{"alias":"social","agentName":"Social Media Agent","instructions":"Create platform-specific social media posts (Twitter, LinkedIn, Instagram)."}},
                {"id":"agent_2","type":"agent","position":{"x":260,"y":260},"data":{"alias":"blog","agentName":"Blog Writer","instructions":"Write an SEO-optimized blog post with headings and clear structure."}},
                {"id":"agent_3","type":"agent","position":{"x":260,"y":420},"data":{"alias":"email","agentName":"Email Marketer","instructions":"Draft a compelling email campaign with subject line, body, and CTA."}},
                {"id":"end_1","type":"end","position":{"x":460,"y":260},"data":{}}
              ],
              "edges": [
                {"id":"e1","source":"start_1","target":"agent_1","animated":true},
                {"id":"e2","source":"start_1","target":"agent_2","animated":true},
                {"id":"e3","source":"start_1","target":"agent_3","animated":true},
                {"id":"e4","source":"agent_1","target":"end_1","animated":true},
                {"id":"e5","source":"agent_2","target":"end_1","animated":true},
                {"id":"e6","source":"agent_3","target":"end_1","animated":true}
              ]
            }
            """);
    }

    private String marketingYaml() {
        return """
                orchestration_type: concurrent
                name: Marketing Campaign

                agents:
                - ref: ""
                  alias: social
                  instructions: "Create platform-specific social media posts (Twitter, LinkedIn, Instagram)."
                - ref: ""
                  alias: blog
                  instructions: "Write an SEO-optimized blog post with headings and clear structure."
                - ref: ""
                  alias: email
                  instructions: "Draft a compelling email campaign with subject line, body, and CTA."
                """;
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private TemplateDto toDto(Template t) {
        return TemplateDto.builder()
                .id(t.getId())
                .name(t.getName())
                .description(t.getDescription())
                .category(t.getCategory())
                .orchestrationType(t.getOrchestrationType())
                .graphJson(t.getGraphJson())
                .yamlContent(t.getYamlContent())
                .isBuiltin(t.isBuiltin())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
