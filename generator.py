from PIL import Image, ImageDraw
import random

# Define image size
width, height = 64, 64  # Larger size for pixel art

def generate_random_color():
    return (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))

def generate_fur_color():
    # Constrain fur colors to white, black, and brown
    fur_colors = [(255, 255, 255), (0, 0, 0), (139, 69, 19)]
    return random.choice(fur_colors)

def generate_rodent_image():
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    # Define random characteristics
    head_color = generate_fur_color()
    body_color = generate_random_color()
    ear_size = random.randint(4, 12)
    head_width = random.randint(20, 30)
    head_height = random.randint(20, 30)
    head_x = (width - head_width) // 2
    head_y = (height // 3)

    # Draw the rodent body
    body_width = head_width - 10
    body_height = head_height + 10
    body_x = (width - body_width) // 2
    body_y = head_y + head_height // 2
    draw.rectangle([body_x, body_y, body_x + body_width, body_y + body_height], fill=body_color)

    # Draw the rodent head
    draw.ellipse([head_x, head_y, head_x + head_width, head_y + head_height], fill=head_color)

    # Draw the rodent ears
    ear_color = head_color
    ear1_x = head_x - ear_size // 2
    ear1_y = head_y - ear_size // 2
    ear2_x = head_x + head_width - ear_size // 2
    ear2_y = head_y - ear_size // 2
    draw.ellipse([ear1_x, ear1_y, ear1_x + ear_size, ear1_y + ear_size], fill=ear_color)
    draw.ellipse([ear2_x, ear2_y, ear2_x + ear_size, ear2_y + ear_size], fill=ear_color)

    # Draw the rodent eyes
    eye_color = (0, 0, 0)
    eye_size = 4
    eye1_x = head_x + head_width // 4 - eye_size // 2
    eye1_y = head_y + head_height // 3 - eye_size // 2
    eye2_x = head_x + 3 * head_width // 4 - eye_size // 2
    eye2_y = head_y + head_height // 3 - eye_size // 2
    draw.ellipse([eye1_x, eye1_y, eye1_x + eye_size, eye1_y + eye_size], fill=eye_color)
    draw.ellipse([eye2_x, eye2_y, eye2_x + eye_size, eye2_y + eye_size], fill=eye_color)

    # Draw the rodent nose
    nose_color = (255, 105, 180)
    nose_width = 6
    nose_height = 4
    nose_x = head_x + head_width // 2 - nose_width // 2
    nose_y = head_y + 2 * head_height // 3 - nose_height // 2
    draw.ellipse([nose_x, nose_y, nose_x + nose_width, nose_y + nose_height], fill=nose_color)

    # Draw the rodent mouth
    mouth_color = (0, 0, 0)
    mouth_width = 10
    mouth_height = 2
    mouth_x = head_x + head_width // 2 - mouth_width // 2
    mouth_y = nose_y + nose_height
    draw.rectangle([mouth_x, mouth_y, mouth_x + mouth_width, mouth_y + mouth_height], fill=mouth_color)

    # Draw the rodent tail
    tail_color = body_color
    tail_x = body_x + body_width
    tail_y = body_y + 3 * body_height // 4
    draw.line([tail_x, tail_y, tail_x + 12, tail_y], fill=tail_color, width=4)

    return image

def generate_island_image():
    image = Image.new("RGB", (width, height), "blue")
    draw = ImageDraw.Draw(image)

    # Draw the island base
    island_color = generate_random_color()
    draw.ellipse([8, 32, 56, 56], fill=island_color)

    # Draw a tree on the island
    tree_trunk_color = generate_random_color()
    draw.rectangle([32, 16, 34, 32], fill=tree_trunk_color)
    tree_leaves_color = generate_random_color()
    draw.ellipse([24, 8, 42, 24], fill=tree_leaves_color)

    return image