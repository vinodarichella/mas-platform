package com.masplatform.user;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepo;

    @GetMapping("/me")
    public UserProfileDto getProfile(@AuthenticationPrincipal UserDetails user) {
        return userRepo.findById(UUID.fromString(user.getUsername()))
                .map(UserProfileDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @PutMapping("/me/preferences")
    public UserProfileDto updatePreferences(@AuthenticationPrincipal UserDetails user,
                                             @RequestBody Map<String, Object> preferences) {
        User u = userRepo.findById(UUID.fromString(user.getUsername()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        u.setPreferences(preferences);
        return UserProfileDto.from(userRepo.save(u));
    }

    public record UserProfileDto(UUID id, String email, String name, Map<String, Object> preferences) {
        static UserProfileDto from(User u) {
            return new UserProfileDto(u.getId(), u.getEmail(), u.getName(), u.getPreferences());
        }
    }
}
